/**
 * Extract requirements from the KYC source documents.
 *
 * Reads the three documents from source_document, splits them on their own
 * headings, extracts requirements per section, verifies every quote against
 * the source, and writes extracted-requirements.json for review and seeding.
 *
 * Usage: npx tsx scripts/extract-from-kyc-docs.ts
 *        npx tsx scripts/extract-from-kyc-docs.ts --dry-run
 *
 * This costs real API credit. It writes a file and never touches the database.
 * --dry-run shows how the documents will be split and calls nothing, so the
 * chunking can be checked before spending anything.
 */

import { PrismaClient } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import fs from "node:fs";

// tsx does not load .env files, and the script previously read
// process.env.ANTHROPIC_API_KEY straight into the client — which was undefined
// unless the key happened to be exported in the shell.
for (const file of [".env", ".env.local"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

import { isQuoteInSource } from "../lib/grounding";

const prisma = new PrismaClient();
const anthropic = new Anthropic();

// claude-3-5-sonnet-20241022 is retired, and date-suffixed ids are not the
// current form. This is the model the rest of the pipeline runs on.
const MODEL = "claude-opus-5";

// Characters, not tokens. Sections are kept whole where they fit, so a
// requirement is never split from the rule that qualifies it.
const MAX_SECTION_CHARS = 14000;

// A section shorter than this is a bare heading or a one-line lead-in. On its
// own it costs a whole API call and yields nothing, so it is folded into the
// section that follows it — which is the content it was introducing anyway.
const MIN_SECTION_CHARS = 400;

// How many sections are extracted at once. Enough to be quick, few enough not
// to trip a rate limit.
const CONCURRENCY = 3;

const RequirementSchema = z.object({
  title: z.string(),
  description: z.string(),
  recordType: z.enum([
    "feature",
    "business-rule",
    "regulatory-constraint",
    "use-case",
    "acceptance-criteria",
  ]),
  // Verbatim source text. Checked by literal match after the model returns it,
  // so this is a claim that gets tested rather than trusted.
  quote: z.string(),
  tags: z.array(z.string()),
  regulatoryFrameworks: z.array(z.string()),
  // High / Medium / Low to match the rest of the system. The old script emitted
  // must-have / should-have / nice-to-have, which nothing else understands.
  priority: z.enum(["High", "Medium", "Low"]),
  actor: z.string().nullable(),
  trigger: z.string().nullable(),
  happyPath: z.string().nullable(),
});

const ExtractionSchema = z.object({
  requirements: z.array(RequirementSchema),
});

type Extracted = z.infer<typeof RequirementSchema> & {
  sourceDocument: string;
  quoteVerified: boolean;
};

const SYSTEM = `You are a senior business analyst extracting structured requirements from KYC and AML compliance material.

Extract every distinct requirement in the section you are given, as one of five kinds:

- feature: something the system must do, or a quality it must have.
- business-rule: a policy, threshold or decision rule, stated so it can be tested. "Invoices over €10,000 require two approvers." Every distinct threshold or band is its own rule — a scoring table with three bands is three rules.
- regulatory-constraint: an obligation imposed from outside by law, regulation or a standards body. Name the framework in regulatoryFrameworks only where the source names it.
- use-case: a named actor going through a journey end to end. Requires an actor.
- acceptance-criteria: a single checkable statement of what "done" means.

Rules:
- Extract only what the section supports. Do not invent requirements, and do not pad the list.
- Where the source states a number, a threshold or a rule, capture it exactly. Where the source is vague, stay vague — never invent a specific nobody wrote down.
- quote: one VERBATIM quote from this section that supports the requirement. Copy the exact characters as they appear. It must be a full clause, not two words.

The quote is checked against the source by literal string match after you return it. A quote that does not appear exactly is discarded and the requirement is marked unverified — so copy, do not paraphrase.

Available tags: CDD, Sanctions, PEP, KYC, AML, Beneficial, Enhanced, Reporting, Monitoring, Escalation, Risk, Screening, Privacy, Retention, Transactions, Documents, Performance.
Available frameworks: FATF, AML5, PSD2, MiFID, Wolfsberg, EU-AI-Act, GDPR, OFAC.

Return an empty array if the section contains no requirements.`;

/**
 * Splits markdown on its own headings.
 *
 * The previous version split on sentence boundaries at a fixed size, which cut
 * through tables and lists — a threshold could land in one chunk and the rule
 * that qualifies it in the next. Sections are self-contained by construction,
 * so they are the natural unit. An oversized section is split on paragraphs as
 * a fallback.
 */
function chunkByHeadings(text: string, maxChars = MAX_SECTION_CHARS): string[] {
  const lines = text.split("\n");
  const sections: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    // Start a new section at ## or ###, but not at the document title.
    if (/^#{2,3}\s/.test(line) && current.length > 0) {
      sections.push(current.join("\n"));
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) sections.push(current.join("\n"));

  const out: string[] = [];
  for (const section of sections) {
    if (section.trim().length === 0) continue;
    if (section.length <= maxChars) {
      out.push(section);
      continue;
    }
    let buffer = "";
    for (const paragraph of section.split(/\n\s*\n/)) {
      if (buffer && (buffer + paragraph).length > maxChars) {
        out.push(buffer);
        buffer = paragraph;
      } else {
        buffer += (buffer ? "\n\n" : "") + paragraph;
      }
    }
    if (buffer) out.push(buffer);
  }

  // Fold the stubs forward. A heading belongs with the content under it, so
  // merging also gives the model the context that heading was providing.
  const merged: string[] = [];
  let pending = "";
  for (const section of out) {
    const candidate = pending ? `${pending}\n\n${section}` : section;
    if (candidate.length < MIN_SECTION_CHARS) {
      pending = candidate;
      continue;
    }
    merged.push(candidate);
    pending = "";
  }
  // Anything still pending is a trailing stub; it joins the last section rather
  // than becoming a call of its own.
  if (pending) {
    if (merged.length > 0) merged[merged.length - 1] += `\n\n${pending}`;
    else merged.push(pending);
  }

  return merged;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await task(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function extractFromSection(
  filename: string,
  section: string,
  index: number,
  total: number,
): Promise<z.infer<typeof RequirementSchema>[]> {
  const heading = section.split("\n")[0].replace(/^#+\s*/, "").slice(0, 58) || "(untitled)";
  console.log(`  [${index + 1}/${total}] ${heading}`);

  const response = await anthropic.messages.parse({
    model: MODEL,
    // 4000 truncated the reply mid-JSON on any section with real content, and
    // the old free-form parse then threw. Structured output removes the
    // markdown-fence guessing entirely.
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Document: ${filename}\n\nSection:\n\n${section}`,
      },
    ],
    output_config: { format: zodOutputFormat(ExtractionSchema) },
  });

  if (response.stop_reason === "refusal") {
    console.log(`      declined — skipped`);
    return [];
  }
  if (!response.parsed_output) {
    console.log(`      no parseable output — skipped`);
    return [];
  }
  return response.parsed_output.requirements;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(dryRun ? "KYC document extraction — DRY RUN, no API calls\n" : "KYC document extraction\n");

  const docs = await prisma.sourceDocument.findMany({
    where: {
      filename: {
        in: [
          "1-regulatory-requirements.md",
          "2-technical-requirements.md",
          "3-business-scenario.md",
        ],
      },
    },
    orderBy: { filename: "asc" },
  });

  if (docs.length !== 3) {
    throw new Error(
      `Expected 3 documents, found ${docs.length}. Restore them first — they are in mock-data/financial-services-kyc/.`,
    );
  }

  const started = Date.now();
  const all: Extracted[] = [];

  if (dryRun) {
    let sectionTotal = 0;
    for (const doc of docs) {
      const sections = chunkByHeadings(doc.content);
      sectionTotal += sections.length;
      console.log(`${doc.filename} — ${sections.length} sections, ${doc.content.length} chars`);
      sections.forEach((section, i) => {
        const heading = section.split("\n")[0].replace(/^#+\s*/, "").slice(0, 56) || "(untitled)";
        console.log(`  ${String(i + 1).padStart(2)}. ${String(section.length).padStart(6)} chars  ${heading}`);
      });
      console.log();
    }
    console.log(`${sectionTotal} sections total — that is ${sectionTotal} API calls when run for real.`);
    return;
  }

  for (const doc of docs) {
    const sections = chunkByHeadings(doc.content);
    console.log(`${doc.filename} — ${sections.length} sections`);

    const perSection = await mapWithConcurrency(sections, CONCURRENCY, (section, i) =>
      extractFromSection(doc.filename, section, i, sections.length),
    );

    // Grounding is verified here, against the document the quote claims to come
    // from. An unverified quote is kept but flagged, so a reader can see which
    // requirements rest on evidence and which are the model's inference.
    for (const requirement of perSection.flat()) {
      all.push({
        ...requirement,
        sourceDocument: doc.filename,
        quoteVerified: isQuoteInSource(requirement.quote, doc.content),
      });
    }
    console.log(`  extracted ${perSection.flat().length}\n`);
  }

  const byType: Record<string, number> = {};
  all.forEach((r) => (byType[r.recordType] = (byType[r.recordType] || 0) + 1));
  const frameworks = [...new Set(all.flatMap((r) => r.regulatoryFrameworks))];
  const tags = [...new Set(all.flatMap((r) => r.tags))];
  const verified = all.filter((r) => r.quoteVerified).length;

  console.log("Summary");
  console.log(`  total            ${all.length}`);
  Object.entries(byType).forEach(([t, n]) => console.log(`  ${t.padEnd(24)} ${n}`));
  console.log(`  quotes verified  ${verified}/${all.length}`);
  console.log(`  frameworks       ${frameworks.join(", ") || "none"}`);
  console.log(`  tags             ${tags.join(", ") || "none"}`);
  console.log(`  elapsed          ${Math.round((Date.now() - started) / 1000)}s`);

  const outputFile = "extracted-requirements.json";
  fs.writeFileSync(
    outputFile,
    JSON.stringify(
      {
        extractedAt: new Date().toISOString(),
        model: MODEL,
        totalRecords: all.length,
        quotesVerified: verified,
        byType,
        frameworks,
        tags,
        requirements: all,
      },
      null,
      2,
    ),
  );

  console.log(`\nWritten to ${outputFile}`);
  if (verified < all.length) {
    console.log(
      `${all.length - verified} requirement(s) carry a quote that is not in the source — check those before seeding.`,
    );
  }
}

main()
  .catch((e) => {
    console.error("Extraction failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
