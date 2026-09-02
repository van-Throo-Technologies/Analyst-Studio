/**
 * Seeds RuleBase — the retrieval corpus the rules engine queries.
 *
 * Usage:
 *   npx tsx scripts/seed-rulebase.ts                      # every project
 *   npx tsx scripts/seed-rulebase.ts --project "<name>"   # just that one
 *
 * Scope matters once more than one project exists: seeding unscoped mixes two
 * extractions into one corpus, and a retrieval cannot then tell you which run a
 * rule came from.
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
 *   - tags assigned at extraction are used as they are, and keyword matching
 *     only fills in where none were assigned. Re-deriving over the top of them
 *     threw away half of what the model had labelled.
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
  const nameIndex = process.argv.indexOf("--project");
  const projectName = nameIndex !== -1 ? process.argv[nameIndex + 1] : null;

  let projectId: string | null = null;
  if (projectName) {
    const project = await prisma.project.findFirst({ where: { name: projectName } });
    if (!project) throw new Error(`No project named "${projectName}".`);
    projectId = project.id;
    console.log(`Seeding RuleBase from "${projectName}"…`);
  } else {
    const projects = await prisma.project.count();
    if (projects > 1) {
      console.log(
        `Warning: ${projects} projects exist and no --project was given, so every one of them will be seeded into a single corpus.`,
      );
    }
    console.log("Seeding RuleBase from all projects…");
  }

  const requirements = await prisma.requirement.findMany({
    where: projectId ? { projectId } : {},
    orderBy: { createdAt: "asc" },
    include: { project: { select: { industry: true } } },
  });

  // Provenance. sourceDocumentIds records which document a requirement came
  // from; the earlier version wrote the constant "kyc-extraction" over all of
  // it, so a retrieved rule could not say whether it came from the regulatory
  // brief, the technical PRD or the business scenario. In a grounded corpus
  // that is half of what grounding is for.
  const documents = await prisma.sourceDocument.findMany({
    where: projectId ? { projectId } : {},
    select: { id: true, filename: true },
  });
  const filenameById = new Map(documents.map((d) => [d.id, d.filename]));

  const sourceOf = (raw: string | null): string => {
    if (!raw) return "unknown";
    try {
      const ids = JSON.parse(raw);
      if (!Array.isArray(ids)) return "unknown";
      const names = ids
        .map((id: unknown) => (typeof id === "string" ? filenameById.get(id) : undefined))
        .filter((n): n is string => Boolean(n));
      return names.length > 0 ? names.join(", ") : "unknown";
    } catch {
      return "unknown";
    }
  };

  if (requirements.length === 0) {
    console.log("No requirements found — nothing to seed.");
    return;
  }
  console.log(`Found ${requirements.length} requirements`);

  // Tags are computed for parents first so children can inherit them.
  const tagsFor = new Map<string, string[]>();
  const frameworksFor = new Map<string, string[]>();

  for (const r of requirements) {
    const quotes = quotesFrom(r.evidence);

    // Tags assigned during extraction win. The model read the section and chose
    // them; keyword matching is the fallback for records that arrived without
    // any, not a second opinion to overwrite the first.
    const ownTags = r.tags.length
      ? r.tags
      : matchAll(DOMAIN_KEYWORDS, r.title, r.description, r.businessRule);

    const ownFrameworks = r.regulatoryFrameworks.length
      ? r.regulatoryFrameworks
      : matchAll(
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

  // Scoped to the industries being seeded. An unconditional delete here would
  // have wiped every other industry's rules the first time a second industry
  // was added — the whole corpus destroyed by a command that looked like it was
  // only touching one project.
  //
  // Industry is the available granularity: RuleBase records which industry a
  // rule belongs to, not which project produced it. Two projects in the same
  // industry therefore re-seed each other, which is why the count is reported
  // below rather than assumed.
  const industriesSeeded = [...new Set(requirements.map((r) => r.project.industry))];
  const cleared = await prisma.ruleBase.deleteMany({
    where: { industry: { in: industriesSeeded } },
  });
  console.log(
    `Cleared ${cleared.count} existing rule(s) for: ${industriesSeeded.join(", ")}`,
  );

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
        sourceDocument: sourceOf(r.sourceDocumentIds),
        tags: tagsFor.get(r.id) ?? [],
        regulatoryFrameworks: frameworksFor.get(r.id) ?? [],
        // Taken from the project the requirement belongs to. Hardcoding it
        // filed every rule under financial services, so seeding a healthcare
        // project would have put its rules in the wrong corpus and made the
        // ?industry= filter return the wrong answer with no sign of it.
        industry: r.project.industry,
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
  const unknownSource = await prisma.ruleBase.count({ where: { sourceDocument: "unknown" } });
  const industries = await prisma.ruleBase.groupBy({ by: ["industry"], _count: { id: true } });

  console.log("\nRetrieval quality:");
  console.log(`  grounded            ${grounded}/${total}`);
  console.log(`  with source quote   ${quoted}/${total}`);
  console.log(`  linked to a parent  ${linked}/${total}`);
  console.log(`  UNTAGGED            ${untagged}/${total}`);
  console.log(`  source unknown      ${unknownSource}/${total}`);
  console.log("\nBy industry:");
  industries.forEach((i) => console.log(`  ${i.industry.padEnd(24)} ${i._count.id}`));
}

seedRuleBase()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
