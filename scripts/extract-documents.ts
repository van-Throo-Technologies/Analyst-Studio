/**
 * Extract requirements from a folder of source documents.
 *
 * Splits each document on its own headings, extracts requirements per section,
 * verifies every quote against the source, and writes a JSON file for review
 * and seeding.
 *
 * Usage:
 *   npx tsx scripts/extract-documents.ts --dir mock-data/healthcare-hipaa --industry healthcare
 *   npx tsx scripts/extract-documents.ts --dir <folder> --industry <id> --out <file>
 *   npx tsx scripts/extract-documents.ts --dir <folder> --industry <id> --dry-run
 *
 * The tag and framework vocabulary comes from lib/taxonomy.ts for the industry
 * given, so one script serves every industry rather than a copy per industry
 * drifting apart.
 *
 * This costs real API credit. It writes a file and never touches the database.
 * --dry-run shows how the documents will be split and calls nothing.
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
import { INDUSTRIES, RECORD_TYPES, PRIORITIES } from "../lib/constants";
import {
  precisionContract,
  quotingRule,
  literalMatchContract,
  KIND_DEFINITIONS,
} from "../lib/extraction-contract";
import { tagsFor, frameworksFor } from "../lib/taxonomy";

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
  recordType: z.enum(RECORD_TYPES),
  // Verbatim source text. Checked by literal match after the model returns it,
  // so this is a claim that gets tested rather than trusted.
  quote: z.string(),
  tags: z.array(z.string()),
  regulatoryFrameworks: z.array(z.string()),
  // The old script emitted must-have / should-have / nice-to-have, which nothing
  // else understands. Reads the shared list now, so it cannot drift again.
  priority: z.enum(PRIORITIES),
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

function buildSystem(industry: string): string {
  return `You are a senior business analyst extracting structured requirements from ${industry.replace(/-/g, " ")} compliance and product material.

Extract every distinct requirement in the section you are given, as one of five kinds:

- feature: ${KIND_DEFINITIONS.feature}.
- business-rule: ${KIND_DEFINITIONS["business-rule"]}.
- regulatory-constraint: ${KIND_DEFINITIONS["regulatory-constraint"]}. Put the framework in regulatoryFrameworks.
- use-case: ${KIND_DEFINITIONS["use-case"]}.
- acceptance-criteria: a single checkable statement of what "done" means.

Rules:
- Extract only what the section supports. Do not invent requirements, and do not pad the list.
- ${precisionContract()}
- ${quotingRule({ field: "quote", lead: "one VERBATIM quote from this section that supports the requirement" })}

${literalMatchContract({
  subject: "The quote",
  consequence:
    "A quote that does not appear exactly is discarded and the requirement is marked unverified — so copy, do not paraphrase.",
})}

Available tags: ${tagsFor(industry).join(", ")}.
Available frameworks: ${frameworksFor(industry).join(", ")}.

Use the tags exactly as written. Several of them — Privacy, Retention, Monitoring, Audit, Encryption, AccessControl, Consent, IncidentResponse, VendorManagement, Risk, Reporting, Escalation, Performance, Documents — mean the same thing in every industry, and are how someone finds every rule about a concern across the whole business. Apply them whenever they fit, not only when the section uses that word.

Return an empty array if the section contains no requirements.`;
}

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
  system: string,
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
    system,
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

function flag(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] ?? null : null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const dir = flag("dir");
  const industry = flag("industry");
  const outputFile = flag("out") ?? "extracted-requirements.json";

  if (!dir) throw new Error("--dir is required, e.g. --dir mock-data/healthcare-hipaa");
  if (!industry) throw new Error("--industry is required, e.g. --industry healthcare");
  if (!INDUSTRIES.includes(industry as (typeof INDUSTRIES)[number])) {
    throw new Error(`Unknown industry "${industry}". Expected one of: ${INDUSTRIES.join(", ")}.`);
  }
  if (!fs.existsSync(dir)) throw new Error(`No such folder: ${dir}`);

  console.log(
    dryRun
      ? `Document extraction — DRY RUN, no API calls\n`
      : `Document extraction\n`,
  );
  console.log(`  folder:   ${dir}`);
  console.log(`  industry: ${industry}`);
  console.log(`  tags:     ${tagsFor(industry).length} available\n`);

  // Read from disk rather than the database. The documents are the input; they
  // do not need to be loaded into a project before they can be extracted, and
  // requiring that made the script usable for exactly one folder.
  const docs = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")
    .sort()
    .map((filename) => ({
      filename,
      content: fs.readFileSync(`${dir}/${filename}`, "utf8"),
    }));

  if (docs.length === 0) throw new Error(`No .md documents found in ${dir}`);

  const system = buildSystem(industry);

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
      extractFromSection(doc.filename, section, i, sections.length, system),
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

  fs.writeFileSync(
    outputFile,
    JSON.stringify(
      {
        extractedAt: new Date().toISOString(),
        model: MODEL,
        industry,
        sourceFolder: dir,
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
