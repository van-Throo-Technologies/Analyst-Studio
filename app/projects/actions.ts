"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { toProject } from "@/lib/db/mappers";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { displayName } from "@/lib/auth/display-name";
import { AccessDeniedError, requireCapability } from "@/lib/auth/access";
import { generateDomainProfile } from "@/lib/domain/profile";
import {
  actionForChanges,
  diffProject,
  recordProjectAudit,
  summarizeChanges,
} from "@/lib/audit/log";
import { invalid, text, type FormState } from "@/lib/forms";
import {
  projectInputSchema,
  projectUpdateSchema,
  type ProjectInput,
} from "@/lib/schemas/entities";
import { SCENARIO_TYPE_LABELS, INDUSTRY_LABELS } from "@/lib/schemas/enums";

/** Reads the whole project form, including the structured domain context. */
function readProjectForm(formData: FormData) {
  return {
    name: text(formData, "name"),
    description: text(formData, "description"),
    analysisGoal: text(formData, "analysisGoal"),
    industry: text(formData, "industry"),
    subdomain: text(formData, "subdomain"),
    jurisdiction: text(formData, "jurisdiction"),
    regulatorySensitivity: text(formData, "regulatorySensitivity"),
    solutionDomain: text(formData, "solutionDomain"),
    domainContext: text(formData, "domainContext"),
    scenarioType: text(formData, "scenarioType"),
    defaultMode: text(formData, "defaultMode"),
  };
}

/** The subset of a project's fields the domain profile is derived from. */
function domainInputOf(input: ProjectInput) {
  return {
    industry: input.industry,
    subdomain: input.subdomain,
    jurisdiction: input.jurisdiction,
    regulatorySensitivity: input.regulatorySensitivity,
    solutionDomain: input.solutionDomain,
  };
}

export async function createProjectAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // Creating needs a user but no project access — there is no project yet.
  const user = await requireCurrentUser();

  const parsed = projectInputSchema.safeParse(readProjectForm(formData));
  if (!parsed.success) return invalid(parsed.error);

  // Project, ownership and the owner's access row are one unit: a project whose
  // creator cannot open it would be unusable and unrecoverable without auth.
  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: { ...parsed.data, ownerId: user.id },
    });
    await tx.projectAccess.create({
      data: { projectId: created.id, userId: user.id, role: "OWNER" },
    });
    return created;
  });

  await generateDomainProfile(project.id, domainInputOf(parsed.data));

  await recordProjectAudit({
    projectId: project.id,
    userId: user.id,
    action: "created",
    changesSummary: `Created as a ${SCENARIO_TYPE_LABELS[parsed.data.scenarioType].toLowerCase()} project in ${INDUSTRY_LABELS[parsed.data.industry]}, with ${parsed.data.regulatorySensitivity} regulatory sensitivity`,
  });
  await recordProjectAudit({
    projectId: project.id,
    userId: user.id,
    action: "access_granted",
    entityType: "project_access",
    entityId: user.id,
    changesSummary: `${displayName(user)} added as OWNER`,
  });

  revalidatePath("/projects");
  // A new project has nothing to look at yet, so send the analyst straight to
  // intake — the only useful next action.
  redirect(`/projects/${project.id}/sources`);
}

export async function updateProjectAction(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let actor;
  try {
    actor = await requireCapability(projectId, "manage_project");
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }

  const parsed = projectUpdateSchema.safeParse({
    ...readProjectForm(formData),
    status: text(formData, "status"),
  });

  if (!parsed.success) return invalid(parsed.error);

  // Read before writing so the audit entry can say what actually changed
  // rather than just that something did.
  const beforeRow = await prisma.project.findUnique({ where: { id: projectId } });
  if (!beforeRow) return { ok: false, message: "Project no longer exists." };

  const afterRow = await prisma.project.update({
    where: { id: projectId },
    data: parsed.data,
  });

  const changes = diffProject(toProject(beforeRow), toProject(afterRow));

  if (changes.length > 0) {
    await recordProjectAudit({
      projectId,
      userId: actor.user.id,
      action: actionForChanges(changes),
      changes,
      changesSummary: summarizeChanges(changes),
    });
  }

  // Regenerated unconditionally: cheap, and it keeps the profile honest even if
  // the diff logic ever misses a field.
  await generateDomainProfile(projectId, domainInputOf(parsed.data));

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`, "layout");

  return {
    ok: true,
    message:
      changes.length === 0
        ? "No changes to save."
        : `Saved. ${summarizeChanges(changes)}.`,
  };
}

export async function deleteProjectAction(projectId: string): Promise<void> {
  // Throws if the acting user is not an owner. Deliberately not caught: this is
  // a destructive action reached from a confirm step, and a silent no-op would
  // be worse than an error page.
  await requireCapability(projectId, "delete_project");

  // Cascades to every child entity — see onDelete: Cascade in schema.prisma.
  // The audit log goes with it; it records changes to a project, not the fact
  // that a project once existed.
  await prisma.project.delete({ where: { id: projectId } });

  revalidatePath("/projects");
  redirect("/projects");
}
