import "server-only";

import { prisma } from "./prisma";
import { verifySession } from "./dal";

// Both packs are derived views over one requirement set — never a second copy
// of it. Editing a requirement changes both packs, because there is only ever
// one record behind them.

export type PackSection = {
  heading: string;
  // Prose paragraphs, rendered as text.
  body?: string[];
  // Flat bullets.
  bullets?: string[];
  // Requirement-shaped entries, rendered with their badges and sub-lists.
  entries?: PackEntry[];
  // Shown in place of the section when it has no content, so the reader learns
  // that discovery is thin here rather than that the feature is broken.
  emptyNote: string;
};

export type PackEntry = {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  scope: string;
  completionScore: number;
  details: { label: string; items: string[] }[];
};

export type Pack = {
  kind: "ba" | "fa";
  title: string;
  projectName: string;
  generatedFor: string;
  summary: string;
  sections: PackSection[];
  requirementCount: number;
};

function lines(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

async function loadProjectOrdered(projectId: string) {
  const { userId } = await verifySession();

  return prisma.project.findFirst({
    where: { id: projectId, userId },
    include: {
      requirements: { orderBy: { createdAt: "asc" } },
      sourceDocuments: { select: { id: true, filename: true } },
    },
  });
}

type LoadedProject = NonNullable<Awaited<ReturnType<typeof loadProjectOrdered>>>;
type LoadedRequirement = LoadedProject["requirements"][number];

function inPack(requirement: LoadedRequirement, kind: "ba" | "fa") {
  return requirement.packVariant === "both" || requirement.packVariant === kind;
}

function entry(
  requirement: LoadedRequirement,
  details: { label: string; items: string[] }[],
): PackEntry {
  return {
    id: requirement.id,
    title: requirement.title,
    description: requirement.description,
    type: requirement.type,
    priority: requirement.priority,
    scope: requirement.scope,
    completionScore: requirement.completionScore,
    details: details.filter((d) => d.items.length > 0),
  };
}

/** The Business Analyst pack: what the problem is and what the business needs. */
export async function generateBAPack(projectId: string): Promise<Pack | null> {
  const project = await loadProjectOrdered(projectId);
  if (!project) return null;

  const requirements = project.requirements.filter((r) => inPack(r, "ba"));
  const inScope = requirements.filter((r) => r.scope !== "out-of-scope");
  const outOfScope = requirements.filter((r) => r.scope === "out-of-scope");

  const openQuestions = requirements.flatMap((r) => lines(r.validationGates));
  const thin = requirements.filter((r) => r.completionScore < 40);

  // The problem statement is assembled from what the requirements reveal rather
  // than asked of the model a second time: the gaps *are* the problem framing.
  const problem: string[] = [];
  if (requirements.length > 0) {
    problem.push(
      `${project.name} covers ${requirements.length} requirement${requirements.length === 1 ? "" : "s"} drawn from ${project.sourceDocuments.length} source document${project.sourceDocuments.length === 1 ? "" : "s"}.`,
    );
    const highs = requirements.filter((r) => r.priority === "High").length;
    if (highs > 0) {
      problem.push(
        `${highs} of them ${highs === 1 ? "is" : "are"} High priority, which is where the business pressure sits.`,
      );
    }
    if (thin.length > 0) {
      problem.push(
        `${thin.length} requirement${thin.length === 1 ? " is" : "s are"} under 40% specified — discovery is not finished in ${thin.length === 1 ? "that area" : "those areas"}.`,
      );
    }
    if (openQuestions.length > 0) {
      problem.push(
        `${openQuestions.length} open question${openQuestions.length === 1 ? "" : "s"} must be resolved before build can be scoped with confidence.`,
      );
    }
  }

  const sections: PackSection[] = [
    {
      heading: "Problem statement",
      body: problem,
      emptyNote: "No requirements yet, so there is nothing to frame.",
    },
    {
      heading: "Stakeholders and actors",
      bullets: unique(requirements.map((r) => r.actor ?? "")),
      emptyNote: "No actors were named in the source material.",
    },
    {
      heading: "Business goals",
      entries: requirements
        .filter((r) => r.type === "Business" || r.priority === "High")
        .map((r) => entry(r, [{ label: "Business rule", items: lines(r.businessRule) }])),
      emptyNote: "No business-level requirements were identified.",
    },
    {
      heading: "In scope",
      bullets: inScope.map((r) => r.title),
      emptyNote: "Nothing is marked in scope.",
    },
    {
      heading: "Out of scope",
      bullets: outOfScope.map((r) => r.title),
      emptyNote: "Nothing was explicitly ruled out. Worth confirming — an unstated boundary is usually an assumed one.",
    },
    {
      heading: "Assumptions",
      bullets: unique(requirements.flatMap((r) => lines(r.assumption))),
      emptyNote: "No assumptions were surfaced. That is rarer than it sounds — it may be worth a second look.",
    },
    {
      heading: "Business rules",
      bullets: unique(requirements.flatMap((r) => lines(r.businessRule))),
      emptyNote: "No policies or rules were stated in the material.",
    },
    {
      heading: "High-level use cases",
      entries: requirements
        .filter((r) => r.actor || r.trigger || r.happyPath)
        .map((r) =>
          entry(r, [
            { label: "Actor", items: r.actor ? [r.actor] : [] },
            { label: "Trigger", items: r.trigger ? [r.trigger] : [] },
          ]),
        ),
      emptyNote: "No requirement described an actor, trigger or flow.",
    },
    {
      heading: "Business acceptance criteria",
      entries: requirements
        .filter((r) => lines(r.checklistAC).length > 0)
        .map((r) => entry(r, [{ label: "Criteria", items: lines(r.checklistAC) }])),
      emptyNote: "No acceptance criteria have been written yet.",
    },
    {
      heading: "Open questions",
      bullets: unique(openQuestions),
      emptyNote: "Nothing outstanding was recorded.",
    },
  ];

  return {
    kind: "ba",
    title: "Business Analyst Pack",
    projectName: project.name,
    generatedFor: "Sponsors, product owners and anyone deciding what to build",
    summary:
      "Frames the problem, the people involved, the boundaries and the rules. It answers what the business needs and why, without specifying how.",
    sections,
    requirementCount: requirements.length,
  };
}

/** The Functional Analyst pack: how the solution must behave. */
export async function generateFAPack(projectId: string): Promise<Pack | null> {
  const project = await loadProjectOrdered(projectId);
  if (!project) return null;

  const requirements = project.requirements.filter((r) => inPack(r, "fa"));
  const buildable = requirements.filter((r) => r.scope !== "out-of-scope");

  const sections: PackSection[] = [
    {
      heading: "Functional requirements",
      entries: buildable
        .filter((r) => r.type === "Functional" || r.type === "Data" || r.type === "Integration")
        .map((r) =>
          entry(r, [
            { label: "Actor", items: r.actor ? [r.actor] : [] },
            { label: "Validation", items: lines(r.validation) },
          ]),
        ),
      emptyNote: "No functional, data or integration requirements were identified.",
    },
    {
      heading: "Non-functional requirements",
      entries: buildable
        .filter((r) => r.type === "Non-Functional")
        .map((r) => entry(r, [{ label: "Validation", items: lines(r.validation) }])),
      emptyNote: "No performance, security or availability constraints were captured.",
    },
    {
      heading: "Detailed use cases",
      entries: buildable
        .filter((r) => r.happyPath || lines(r.alternateFlows).length > 0)
        .map((r) =>
          entry(r, [
            { label: "Precondition", items: lines(r.precondition) },
            { label: "Trigger", items: r.trigger ? [r.trigger] : [] },
            { label: "Main flow", items: r.happyPath ? [r.happyPath] : [] },
            { label: "Alternate flows", items: lines(r.alternateFlows) },
          ]),
        ),
      emptyNote: "No requirement described a flow in enough detail to write a use case.",
    },
    {
      heading: "Preconditions",
      bullets: unique(buildable.flatMap((r) => lines(r.precondition))),
      emptyNote: "No preconditions were stated.",
    },
    {
      heading: "Validations and constraints",
      bullets: unique(buildable.flatMap((r) => lines(r.validation))),
      emptyNote: "No validation rules were described. Field-level rules are usually assumed rather than stated — worth asking.",
    },
    {
      heading: "Dependencies",
      entries: buildable
        .filter((r) => lines(r.dependency).length > 0)
        .map((r) => entry(r, [{ label: "Depends on", items: lines(r.dependency) }])),
      emptyNote: "No requirement declared a dependency on another.",
    },
    {
      heading: "Functional acceptance criteria",
      entries: buildable
        .filter((r) => lines(r.bdDAC).length > 0 || lines(r.checklistAC).length > 0)
        .map((r) =>
          entry(r, [
            { label: "Given / When / Then", items: lines(r.bdDAC) },
            { label: "Checklist", items: lines(r.checklistAC) },
          ]),
        ),
      emptyNote: "No acceptance criteria have been written yet.",
    },
    {
      heading: "Excluded from build",
      bullets: requirements.filter((r) => r.scope === "out-of-scope").map((r) => r.title),
      emptyNote: "Nothing is marked out of scope.",
    },
  ];

  return {
    kind: "fa",
    title: "Functional Analyst Pack",
    projectName: project.name,
    generatedFor: "Developers, testers and anyone specifying how it behaves",
    summary:
      "Specifies behaviour: the flows, the preconditions, the validations and the criteria a build must satisfy to be accepted.",
    sections,
    requirementCount: requirements.length,
  };
}

export async function generatePack(projectId: string, kind: "ba" | "fa") {
  return kind === "ba" ? generateBAPack(projectId) : generateFAPack(projectId);
}
