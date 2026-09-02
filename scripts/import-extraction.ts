/**
 * Imports extracted-requirements.json into the Requirement table.
 *
 * Usage:
 *   npx tsx scripts/import-extraction.ts                 # dry run, changes nothing
 *   npx tsx scripts/import-extraction.ts --write         # into a NEW project
 *   npx tsx scripts/import-extraction.ts --write --industry healthcare
 *   npx tsx scripts/import-extraction.ts --write --input other.json --name "..." 
 *   npx tsx scripts/import-extraction.ts --write --replace-project "<name>"
 *
 * Defaults to a dry run, and to creating a new project rather than touching an
 * existing one. Replacing is opt-in and names its target, because the last
 * thing to overwrite data in this repo lost all of it.
 */

import { PrismaClient } from "@prisma/client";
import fs from "node:fs";

import { INDUSTRIES } from "../lib/constants";

for (const file of [".env", ".env.local"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const prisma = new PrismaClient();

const DEFAULT_INPUT = "extracted-requirements.json";
const DEFAULT_PROJECT_NAME = "KYC Extraction (526 records)";
const DEFAULT_INDUSTRY = "financial-services";

function flag(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] ?? null : null;
}

type Incoming = {
  title: string;
  description: string;
  recordType: string;
  quote: string;
  quoteVerified: boolean;
  sourceDocument: string;
  tags: string[];
  regulatoryFrameworks: string[];
  priority: string;
  actor: string | null;
  trigger: string | null;
  happyPath: string | null;
};

// Tags and frameworks are carried through as they were extracted. The model
// assigned 1,464 tags across these records; dropping them and re-deriving from
// keywords recovered barely half and left 80 records unreachable by tag search.
// The first framework is also mirrored into `validation`, which is where the
// pack generator and the seed already look for a constraint's framework.
function toRow(r: Incoming, projectId: string, documentIds: Record<string, string>) {
  const docId = documentIds[r.sourceDocument];
  return {
    projectId,
    recordType: r.recordType,
    // The extraction carries no hierarchy: it reads sections independently and
    // never learns which feature a rule belongs to. Left null rather than
    // guessed — a wrong parent is worse than none, because it silently files a
    // rule under the wrong requirement.
    parentRequirementId: null,
    title: r.title.slice(0, 300),
    description: r.description,
    type:
      r.recordType === "regulatory-constraint"
        ? "Non-Functional"
        : r.recordType === "business-rule"
          ? "Business"
          : "Functional",
    priority: r.priority,
    actor: r.actor,
    trigger: r.trigger,
    happyPath: r.happyPath,
    businessRule: r.recordType === "business-rule" || r.recordType === "regulatory-constraint"
      ? r.description
      : null,
    validation: r.regulatoryFrameworks[0] ?? null,
    tags: r.tags,
    regulatoryFrameworks: r.regulatoryFrameworks,
    completionScore: 0,
    scope: "in-scope",
    packVariant: "both",
    sourceDocumentIds: JSON.stringify(docId ? [docId] : []),
    // Only quotes that passed the literal source match are stored as evidence.
    evidence: JSON.stringify(r.quoteVerified ? [r.quote] : []),
    isGrounded: r.quoteVerified,
  };
}

async function main() {
  const write = process.argv.includes("--write");
  const replaceName = flag("replace-project");
  const INPUT = flag("input") ?? DEFAULT_INPUT;
  const projectName = flag("name") ?? DEFAULT_PROJECT_NAME;
  const industry = flag("industry") ?? DEFAULT_INDUSTRY;

  if (!INDUSTRIES.includes(industry as (typeof INDUSTRIES)[number])) {
    throw new Error(`Unknown industry "${industry}". Expected one of: ${INDUSTRIES.join(", ")}.`);
  }

  if (!fs.existsSync(INPUT)) {
    throw new Error(`${INPUT} not found — run the extraction first.`);
  }
  const payload = JSON.parse(fs.readFileSync(INPUT, "utf8"));
  const records: Incoming[] = payload.requirements;

  const byType: Record<string, number> = {};
  records.forEach((r) => (byType[r.recordType] = (byType[r.recordType] || 0) + 1));
  const verified = records.filter((r) => r.quoteVerified).length;

  console.log(`${INPUT}: ${records.length} records, extracted ${payload.extractedAt}`);
  Object.entries(byType).forEach(([t, n]) => console.log(`  ${t.padEnd(24)} ${n}`));
  console.log(`  ${"quotes verified".padEnd(24)} ${verified}/${records.length}`);
  console.log(`  ${"parent links".padEnd(24)} 0 (the extraction carries no hierarchy)\n`);

  if (!write) {
    console.log("DRY RUN — nothing written. Re-run with --write to import.");
    if (replaceName) console.log(`Would replace the requirements in project "${replaceName}".`);
    else console.log(`Would create a new project "${projectName}" (industry: ${industry}) and leave existing projects alone.`);
    return;
  }

  const owner = await prisma.user.findFirst();
  if (!owner) throw new Error("No user in the database to own the project.");

  let project;
  if (replaceName) {
    project = await prisma.project.findFirst({ where: { name: replaceName } });
    if (!project) throw new Error(`No project named "${replaceName}".`);
    const existing = await prisma.requirement.count({ where: { projectId: project.id } });
    console.log(`Replacing ${existing} requirements in "${project.name}"…`);
    await prisma.requirement.deleteMany({ where: { projectId: project.id } });
  } else {
    project = await prisma.project.create({
      data: { name: projectName, industry, userId: owner.id },
    });
    console.log(`Created project "${project.name}" (industry: ${industry})`);
  }

  // Source documents, so trace links point at something real.
  //
  // Filenames come from the extraction itself, not a hardcoded list. Hardcoding
  // them meant a renamed document produced no source row, and every record from
  // it lost its provenance — 210 rules reporting "source unknown" while the
  // file sat right there in the folder.
  const dir: string = payload.sourceFolder ?? "mock-data/financial-services-kyc";
  const filenames = [...new Set(records.map((r) => r.sourceDocument))].filter(
    (f) => fs.existsSync(`${dir}/${f}`),
  );
  if (filenames.length === 0) {
    throw new Error(`None of the extraction's source documents were found in ${dir}`);
  }

  const documentIds: Record<string, string> = {};
  for (const filename of filenames) {
    const existing = await prisma.sourceDocument.findFirst({
      where: { projectId: project.id, filename },
    });
    documentIds[filename] =
      existing?.id ??
      (
        await prisma.sourceDocument.create({
          data: {
            projectId: project.id,
            filename,
            mimeType: "text/markdown",
            content: fs.readFileSync(`${dir}/${filename}`, "utf8"),
          },
        })
      ).id;
  }

  await prisma.requirement.createMany({
    data: records.map((r) => toRow(r, project.id, documentIds)),
  });

  const written = await prisma.requirement.groupBy({
    by: ["recordType"],
    where: { projectId: project.id },
    _count: { id: true },
  });
  console.log(`\nImported into "${project.name}" (${project.id}):`);
  written.forEach((t) => console.log(`  ${t.recordType.padEnd(24)} ${t._count.id}`));
  console.log(`  ${"TOTAL".padEnd(24)} ${records.length}`);
  console.log(`\nNext: npx tsx scripts/seed-rulebase.ts --project "${project.name}"`);
}

main()
  .catch((e) => {
    console.error("Import failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
