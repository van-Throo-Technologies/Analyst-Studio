/**
 * Seeds RuleBase — the retrieval corpus the rules engine queries.
 *
 * This is a RAG database, so it is judged on whether a search finds the right
 * rule, not on how many rows it has. Three things follow from that, and all
 * three were wrong in the first version of this script:
 *
 *   - recordType is carried across, not re-derived. The earlier version read
 *     `type` (Functional / Business / Non-Functional / Data / Integration)
 *     rather than `recordType`, so every feature was filed as a business rule
 *     and every regulatory constraint vanished — which is why filtering by
 *     framework returned nothing.
 *
 *   - quote holds the verified source evidence, not acceptance-criteria text.
 *     The quote is what grounds a retrieved rule; filling it with criteria made
 *     isGrounded mean "has criteria", which is not grounding at all.
 *
 *   - children inherit their parent's tags. An acceptance criterion about
 *     customer due diligence has to be findable under CDD, and on its own its
 *     one line rarely contains the keyword. Untagged rows are unreachable by
 *     tag search, and they were 60% of the corpus.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  CDD: ["customer due diligence", "cdd", "identify", "identification", "verification", "onboarding", "verify"],
  Sanctions: ["sanctions", "screening", "screen", "ofac", "sdn", "watchlist", "embargo"],
  PEP: ["politically exposed", "pep", "public office", "government official"],
  Monitoring: ["ongoing monitoring", "transaction monitoring", "suspicious activity", "monitor", "review cycle", "periodic review"],
  Enhanced: ["enhanced due diligence", "edd", "higher risk", "high-risk", "enhanced"],
  Beneficial: ["beneficial owner", "ultimate owner", "ownership", "ubo", "shareholder"],
  AML: ["anti-money laundering", "aml", "money laundering", "terrorist financing", "cft"],
  KYC: ["know your customer", "kyc", "customer identity"],
  Retention: ["retention", "record keeping", "retain", "archive", "audit trail"],
  Risk: ["risk score", "risk assessment", "risk rating", "scoring"],
  Reporting: ["sar", "suspicious activity report", "ctr", "fiu", "regulatory report", "filing"],
  Escalation: ["escalate", "escalation", "compliance officer", "sign-off", "approval"],
  Documents: ["document upload", "ocr", "proof of address", "passport", "identity document"],
  Transactions: ["transaction", "threshold", "structuring", "payment", "cumulative"],
  Performance: ["latency", "response time", "throughput", "concurrent", "uptime", "availability"],
  Privacy: ["gdpr", "personal data", "pii", "encryption", "deletion", "masking"],
};

const FRAMEWORK_KEYWORDS: Record<string, string[]> = {
  FATF: ["fatf", "40 recommendations", "recommendation 10"],
  AML5: ["aml5", "fifth directive", "amld5", "5th anti-money laundering"],
  PSD2: ["psd2", "payment services directive", "strong customer authentication"],
  MiFID: ["mifid", "markets in financial instruments"],
  Wolfsberg: ["wolfsberg", "correspondent banking"],
  "EU-AI-Act": ["eu ai act", "ai act", "artificial intelligence act"],
  GDPR: ["gdpr", "general data protection"],
  OFAC: ["ofac", "specially designated nationals", "sdn list"],
};

function matchAll(dictionary: Record<string, string[]>, ...parts: (string | null | undefined)[]) {
  const content = parts.filter(Boolean).join(" ").toLowerCase();
  const found = new Set<string>();
  for (const [label, keywords] of Object.entries(dictionary)) {
    if (keywords.some((kw) => content.includes(kw))) found.add(label);
  }
  return [...found];
}

/** Verified quotes, stored as a JSON array on the requirement. */
function quotesFrom(evidence: string | null): string[] {
  if (!evidence) return [];
  try {
    const parsed = JSON.parse(evidence);
    return Array.isArray(parsed) ? parsed.filter((q): q is string => typeof q === "string") : [];
  } catch {
    return [];
  }
}

async function seedRuleBase() {
  console.log("Seeding RuleBase…");

  const requirements = await prisma.requirement.findMany({
    orderBy: { createdAt: "asc" },
  });

  if (requirements.length === 0) {
    console.log("No requirements found — nothing to seed.");
    return;
  }
  console.log(`Found ${requirements.length} requirements`);

  const byId = new Map(requirements.map((r) => [r.id, r]));

  // Tags are computed for parents first so children can inherit them.
  const tagsFor = new Map<string, string[]>();
  const frameworksFor = new Map<string, string[]>();

  for (const r of requirements) {
    const quotes = quotesFrom(r.evidence);
    const ownTags = matchAll(DOMAIN_KEYWORDS, r.title, r.description, r.businessRule);
    const ownFrameworks = matchAll(
      FRAMEWORK_KEYWORDS,
      r.title,
      r.description,
      r.businessRule,
      // The framework a constraint names is stored in validation.
      r.validation,
      quotes.join(" "),
    );
    tagsFor.set(r.id, ownTags);
    frameworksFor.set(r.id, ownFrameworks);
  }

  // Second pass: a child with nothing of its own takes what its parent has, so
  // a one-line criterion is still reachable by the topic it belongs to.
  for (const r of requirements) {
    if (!r.parentRequirementId) continue;
    const parentTags = tagsFor.get(r.parentRequirementId) ?? [];
    const parentFrameworks = frameworksFor.get(r.parentRequirementId) ?? [];
    tagsFor.set(r.id, [...new Set([...(tagsFor.get(r.id) ?? []), ...parentTags])]);
    frameworksFor.set(r.id, [...new Set([...(frameworksFor.get(r.id) ?? []), ...parentFrameworks])]);
  }

  await prisma.ruleBase.deleteMany({});

  // Inserted one at a time so the id map is known before children reference it.
  const ruleIdByRequirementId = new Map<string, string>();
  const ordered = [
    ...requirements.filter((r) => !r.parentRequirementId),
    ...requirements.filter((r) => r.parentRequirementId),
  ];

  for (const r of ordered) {
    const quotes = quotesFrom(r.evidence);
    const created = await prisma.ruleBase.create({
      data: {
        // Carried across, never re-derived.
        recordType: r.recordType,
        title: r.title,
        description: r.description,
        // The verified source quote — the thing that grounds a retrieved rule.
        quote: quotes[0] ?? null,
        sourceDocument: "kyc-extraction",
        tags: tagsFor.get(r.id) ?? [],
        regulatoryFrameworks: frameworksFor.get(r.id) ?? [],
        industry: "financial-services",
        parentRuleId: r.parentRequirementId
          ? ruleIdByRequirementId.get(r.parentRequirementId) ?? null
          : null,
        confidence: r.completionScore ? r.completionScore / 100 : null,
        // Real grounding, as verified at extraction — not a proxy for it.
        isGrounded: r.isGrounded,
        isPinned: false,
        version: 1,
      },
      select: { id: true },
    });
    ruleIdByRequirementId.set(r.id, created.id);
  }

  const total = await prisma.ruleBase.count();
  const byType = await prisma.ruleBase.groupBy({ by: ["recordType"], _count: { id: true } });
  const grounded = await prisma.ruleBase.count({ where: { isGrounded: true } });
  const untagged = await prisma.ruleBase.count({ where: { tags: { isEmpty: true } } });
  const linked = await prisma.ruleBase.count({ where: { NOT: { parentRuleId: null } } });
  const quoted = await prisma.ruleBase.count({ where: { NOT: { quote: null } } });

  console.log(`\nSeeded ${total} rules\n`);
  console.log("By record type:");
  byType.forEach((t) => console.log(`  ${t.recordType.padEnd(24)} ${t._count.id}`));
  console.log("\nRetrieval quality:");
  console.log(`  grounded            ${grounded}/${total}`);
  console.log(`  with source quote   ${quoted}/${total}`);
  console.log(`  linked to a parent  ${linked}/${total}`);
  console.log(`  UNTAGGED            ${untagged}/${total}`);
}

seedRuleBase()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
