// Rebuilds the Requirement table from tests/fixtures/kyc-extraction.json.
//
// The fixture is a 100-record capture of a 626-record extraction — it holds
// every feature, which is the expensive part, plus some of the children. The
// acceptance criteria are regenerated from each feature's own criteria lines,
// exactly as the pipeline derives them, so they cost nothing to rebuild.
//
// Ids are preserved from the fixture so parentRequirementId keeps pointing at
// the right row.
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";

for (const l of fs.readFileSync(".env", "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const prisma = new PrismaClient();
const rows = Object.values(JSON.parse(fs.readFileSync("tests/fixtures/kyc-extraction.json", "utf8")));

const OWNER_EMAIL = "janinevanthroo@gmail.com";
const user =
  (await prisma.user.findUnique({ where: { email: OWNER_EMAIL } })) ??
  (await prisma.user.create({ data: { email: OWNER_EMAIL } }));

const project = await prisma.project.create({
  data: { name: "KYC Reference (restored)", industry: "financial-services", userId: user.id },
});

// Source documents come back from git, so the trace links have somewhere real
// to point.
const docIds = {};
for (const filename of [
  "1-regulatory-requirements.md",
  "2-technical-requirements.md",
  "3-business-scenario.md",
]) {
  const doc = await prisma.sourceDocument.create({
    data: {
      projectId: project.id,
      filename,
      mimeType: "text/markdown",
      content: fs.readFileSync(`mock-data/financial-services-kyc/${filename}`, "utf8"),
    },
  });
  docIds[filename] = doc.id;
}
const allDocIds = JSON.stringify(Object.values(docIds));

const present = new Set(rows.map((r) => r.id));
const lines = (v) => (v || "").split("\n").map((s) => s.trim()).filter(Boolean);

const restored = rows.map((r) => ({
  id: r.id,
  projectId: project.id,
  recordType: r.recordType,
  // A parent outside the 100-record capture would be a dangling pointer, so
  // those children become top-level rather than broken.
  parentRequirementId: r.parentRequirementId && present.has(r.parentRequirementId)
    ? r.parentRequirementId
    : null,
  title: r.title,
  description: r.description ?? "",
  type: r.type ?? "Functional",
  priority: r.priority ?? "Medium",
  actor: r.actor ?? null,
  trigger: r.trigger ?? null,
  happyPath: r.happyPath ?? null,
  alternateFlows: r.alternateFlows ?? null,
  bdDAC: r.bdDAC ?? null,
  checklistAC: r.checklistAC ?? null,
  completionScore: r.completionScore ?? 0,
  validationGates: r.validationGates ?? null,
  businessRule: r.businessRule ?? null,
  validation: r.validation ?? null,
  scope: r.scope ?? "in-scope",
  packVariant: r.packVariant ?? "both",
  sourceDocumentIds: r.sourceDocumentIds ?? allDocIds,
  evidence: r.evidence ?? "[]",
  isGrounded: Boolean(r.isGrounded),
}));

await prisma.requirement.createMany({ data: restored });

// Regenerate the acceptance-criteria children the same way the pipeline does:
// one row per criteria line on each feature.
const features = restored.filter((r) => r.recordType === "feature");
const derived = features.flatMap((f) =>
  [...lines(f.bdDAC), ...lines(f.checklistAC)].map((line) => ({
    projectId: project.id,
    recordType: "acceptance-criteria",
    parentRequirementId: f.id,
    title: line.length > 180 ? `${line.slice(0, 177)}…` : line,
    description: line,
    type: f.type,
    priority: f.priority,
    completionScore: 0,
    sourceDocumentIds: f.sourceDocumentIds,
    evidence: "[]",
    isGrounded: f.isGrounded,
  })),
);

// The capture already contains 8 acceptance criteria; regenerating from the
// features would duplicate them, so those are dropped in favour of the
// complete derived set.
await prisma.requirement.deleteMany({
  where: { projectId: project.id, recordType: "acceptance-criteria", parentRequirementId: null },
});
await prisma.requirement.createMany({ data: derived });

const byType = await prisma.requirement.groupBy({
  by: ["recordType"],
  where: { projectId: project.id },
  _count: { id: true },
});
console.log(`restored into project "${project.name}" (${project.id}):`);
byType.forEach((t) => console.log(`  ${t.recordType.padEnd(24)} ${t._count.id}`));
console.log(`  ${"TOTAL".padEnd(24)} ${await prisma.requirement.count({ where: { projectId: project.id } })}`);
await prisma.$disconnect();
