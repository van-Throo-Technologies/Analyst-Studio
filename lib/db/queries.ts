import "server-only";
import { prisma } from "@/lib/db/client";
import * as map from "@/lib/db/mappers";
import type * as Domain from "@/lib/schemas/entities";
import { PRIORITY_ORDER, projectRoleSchema, type ProjectRole } from "@/lib/schemas/enums";

/** Read-side helpers. Writes live in the server actions under /app. */

export type ProjectListItem = Domain.Project & {
  sourceCount: number;
  /** How many of those sources someone has vouched for. */
  validatedSourceCount: number;
  /** How many are still waiting on a decision. Rejected is neither. */
  pendingSourceCount: number;
  requirementCount: number;
  packCount: number;
  memberCount: number;
  /** The listing user's own role on this project. */
  role: ProjectRole;
};

/**
 * Projects the given user can see.
 *
 * Filtered by ProjectAccess membership, not by ownership — a BA added to
 * someone else's project must see it, and an owner must not see projects they
 * were never added to. There is no "list everything" query on purpose.
 */
export async function listProjectsForUser(
  userId: string,
): Promise<ProjectListItem[]> {
  const rows = await prisma.project.findMany({
    where: { access: { some: { userId } } },
    orderBy: { updatedAt: "desc" },
    include: {
      access: { where: { userId }, take: 1 },
      _count: {
        select: {
          sourceDocuments: true,
          requirements: true,
          packOutputs: true,
          access: true,
        },
      },
    },
  });

  // Validation state is a group-by rather than four more `_count` filters:
  // one extra query for every project on the page, instead of one per project.
  const validationCounts = await prisma.sourceDocument.groupBy({
    by: ["projectId", "validationStatus"],
    where: { projectId: { in: rows.map((row) => row.id) } },
    _count: { _all: true },
  });

  const countFor = (projectId: string, status: string) =>
    validationCounts.find(
      (row) => row.projectId === projectId && row.validationStatus === status,
    )?._count._all ?? 0;

  return rows.map((row) => ({
    ...map.toProject(row),
    sourceCount: row._count.sourceDocuments,
    validatedSourceCount: countFor(row.id, "validated"),
    pendingSourceCount: countFor(row.id, "pending"),
    requirementCount: row._count.requirements,
    packCount: row._count.packOutputs,
    memberCount: row._count.access,
    role: projectRoleSchema.catch("REVIEWER").parse(row.access[0]?.role ?? "REVIEWER"),
  }));
}

/** Everyone with access to a project, owners first. */
export async function listProjectMembers(
  projectId: string,
): Promise<Domain.ProjectMember[]> {
  const rows = await prisma.projectAccess.findMany({
    where: { projectId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  return rows
    .map((row) => ({
      ...map.toProjectAccess(row),
      user: map.toUser(row.user),
    }))
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
}

const ROLE_ORDER: ProjectRole[] = [
  "OWNER",
  "PM",
  "BA",
  "FA",
  "ARCHITECT",
  "REVIEWER",
];

export async function getProject(id: string): Promise<Domain.Project | null> {
  const row = await prisma.project.findUnique({ where: { id } });
  return row ? map.toProject(row) : null;
}

export async function listSourceDocuments(
  projectId: string,
): Promise<Domain.SourceDocumentWithUploader[]> {
  const rows = await prisma.sourceDocument.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: true, validatedBy: true },
  });
  return rows.map(map.toSourceDocumentWithUploader);
}

export async function getSourceDocument(
  id: string,
): Promise<Domain.SourceDocumentWithUploader | null> {
  const row = await prisma.sourceDocument.findUnique({
    where: { id },
    include: { uploadedBy: true, validatedBy: true },
  });
  return row ? map.toSourceDocumentWithUploader(row) : null;
}

export async function listInsights(
  projectId: string,
): Promise<Domain.ExtractedInsight[]> {
  const rows = await prisma.extractedInsight.findMany({
    where: { projectId },
    orderBy: [{ createdAt: "asc" }],
  });
  return rows.map(map.toExtractedInsight);
}

export async function listPackOutputs(
  projectId: string,
): Promise<Domain.PackOutput[]> {
  const rows = await prisma.packOutput.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(map.toPackOutput);
}

export async function getPackOutput(id: string): Promise<Domain.PackOutput | null> {
  const row = await prisma.packOutput.findUnique({ where: { id } });
  return row ? map.toPackOutput(row) : null;
}

export async function latestPackOutput(
  projectId: string,
  mode: Domain.PackOutput["mode"],
): Promise<Domain.PackOutput | null> {
  const row = await prisma.packOutput.findFirst({
    where: { projectId, mode },
    orderBy: { createdAt: "desc" },
  });
  return row ? map.toPackOutput(row) : null;
}

export async function listOpenAiFindings(
  projectId: string,
): Promise<Domain.AiFinding[]> {
  const rows = await prisma.aiFinding.findMany({
    where: { projectId, status: "open" },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(map.toAiFinding);
}

export type AiGenerationSummary = {
  id: string;
  job: string;
  model: string;
  promptId: string;
  promptVersion: string;
  outcome: string;
  createdAt: Date;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
};

export async function listAiGenerations(
  projectId: string,
  take = 25,
): Promise<AiGenerationSummary[]> {
  return prisma.aiGeneration.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      job: true,
      model: true,
      promptId: true,
      promptVersion: true,
      outcome: true,
      createdAt: true,
      durationMs: true,
      inputTokens: true,
      outputTokens: true,
    },
  });
}

/**
 * Load the entire project in one pass. Pack generation, the quality engine and
 * the traceability view all consume this, which is what keeps them consistent
 * with each other.
 */
export async function loadProjectModel(
  projectId: string,
): Promise<Domain.ProjectModel | null> {
  const projectRow = await prisma.project.findUnique({ where: { id: projectId } });
  if (!projectRow) return null;

  const [
    sourceDocuments,
    insights,
    stakeholders,
    actors,
    businessGoals,
    businessRules,
    requirements,
    useCases,
    acceptanceCriteria,
    dependencies,
    traceLinks,
  ] = await Promise.all([
    prisma.sourceDocument.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.extractedInsight.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.stakeholder.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.actor.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.businessGoal.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.businessRule.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.requirement.findMany({ where: { projectId }, orderBy: { ref: "asc" } }),
    prisma.useCase.findMany({ where: { projectId }, orderBy: { ref: "asc" } }),
    prisma.acceptanceCriterion.findMany({
      where: { projectId },
      orderBy: { ref: "asc" },
    }),
    prisma.dependency.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.traceLink.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    project: map.toProject(projectRow),
    sourceDocuments: sourceDocuments.map(map.toSourceDocument),
    insights: insights.map(map.toExtractedInsight),
    stakeholders: stakeholders.map(map.toStakeholder),
    actors: actors.map(map.toActor),
    businessGoals: businessGoals.map(map.toBusinessGoal),
    businessRules: businessRules.map(map.toBusinessRule),
    requirements: requirements.map(map.toRequirement),
    useCases: useCases.map(map.toUseCase),
    acceptanceCriteria: acceptanceCriteria.map(map.toAcceptanceCriterion),
    dependencies: dependencies.map(map.toDependency),
    traceLinks: traceLinks.map(map.toTraceLink),
  };
}

/** Requirements ordered the way analysts read them: by priority, then by ref. */
export function sortRequirements(
  requirements: Domain.Requirement[],
): Domain.Requirement[] {
  return [...requirements].sort((a, b) => {
    const byPriority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    return byPriority !== 0 ? byPriority : a.ref.localeCompare(b.ref);
  });
}
