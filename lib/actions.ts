"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "./prisma";
import { verifySession } from "./dal";
import { parseUpload, UnsupportedFileError, EmptyDocumentError } from "./documents";
import { REQUIREMENT_TYPES, PRIORITIES } from "./constants";

// Every action re-derives the user from the session and scopes its writes with
// it. An action is a public HTTP endpoint — the fact that the only link to it
// sits on a guarded page protects nothing.

export type ActionState = { error?: string };

export async function createProject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await verifySession();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the project a name." };
  if (name.length > 120) return { error: "That name is too long (120 characters max)." };

  const project = await prisma.project.create({ data: { name, userId } });
  redirect(`/projects/${project.id}`);
}

export async function uploadDocument(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await verifySession();

  const projectId = String(formData.get("projectId") ?? "");
  const file = formData.get("file");
  const pasted = String(formData.get("pasted") ?? "").trim();

  // Confirms the project is this user's before writing anything to it.
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) return { error: "That project could not be found." };

  let parsed: { filename: string; mimeType: string; content: string };

  if (file instanceof File && file.size > 0) {
    try {
      parsed = await parseUpload(file);
    } catch (error) {
      if (error instanceof UnsupportedFileError || error instanceof EmptyDocumentError) {
        return { error: error.message };
      }
      // A malformed or encrypted file reaches here. The parser's own message is
      // usually about internals, so it is replaced with something actionable.
      return {
        error: "That file could not be read. It may be corrupted or password-protected.",
      };
    }
  } else if (pasted) {
    parsed = { filename: "Pasted notes", mimeType: "text/plain", content: pasted };
  } else {
    return { error: "Choose a file or paste some text first." };
  }

  await prisma.sourceDocument.create({ data: { projectId, ...parsed } });

  // Touches the project so the list orders by genuine activity.
  await prisma.project.update({
    where: { id: projectId },
    data: { updatedAt: new Date() },
  });

  revalidatePath(`/projects/${projectId}`);
  return {};
}

export async function deleteDocument(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await verifySession();
  const id = String(formData.get("documentId") ?? "");

  // deleteMany with the ownership join in the where clause: a document that is
  // not this user's matches nothing and is a no-op rather than a deletion.
  const { count } = await prisma.sourceDocument.deleteMany({
    where: { id, project: { userId } },
  });
  if (count === 0) return { error: "That document could not be found." };

  revalidatePath(`/projects/${String(formData.get("projectId") ?? "")}`);
  return {};
}

function optionalText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? null : value;
}

export async function updateRequirement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await verifySession();

  const id = String(formData.get("requirementId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "A requirement needs a title." };

  const type = String(formData.get("type") ?? "");
  const priority = String(formData.get("priority") ?? "");
  if (!REQUIREMENT_TYPES.includes(type as (typeof REQUIREMENT_TYPES)[number])) {
    return { error: "Choose a valid type." };
  }
  if (!PRIORITIES.includes(priority as (typeof PRIORITIES)[number])) {
    return { error: "Choose a valid priority." };
  }

  const score = Number(formData.get("completionScore"));
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    return { error: "The completion score must be a whole number between 0 and 100." };
  }

  // updateMany with the ownership join, for the same reason as the deletes: a
  // requirement belonging to someone else matches nothing rather than updating.
  const { count } = await prisma.requirement.updateMany({
    where: { id, project: { userId } },
    data: {
      title,
      description: String(formData.get("description") ?? "").trim(),
      type,
      priority,
      actor: optionalText(formData, "actor"),
      trigger: optionalText(formData, "trigger"),
      happyPath: optionalText(formData, "happyPath"),
      alternateFlows: optionalText(formData, "alternateFlows"),
      bdDAC: optionalText(formData, "bdDAC"),
      checklistAC: optionalText(formData, "checklistAC"),
      validationGates: optionalText(formData, "validationGates"),
      completionScore: score,
      // Marks it as hand-written, which is what keeps the next extraction run
      // from deleting it.
      isEdited: true,
    },
  });
  if (count === 0) return { error: "That requirement could not be found." };

  revalidatePath(`/projects/${projectId}`);
  return {};
}

export async function deleteRequirement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await verifySession();
  const id = String(formData.get("requirementId") ?? "");

  const { count } = await prisma.requirement.deleteMany({
    where: { id, project: { userId } },
  });
  if (count === 0) return { error: "That requirement could not be found." };

  revalidatePath(`/projects/${String(formData.get("projectId") ?? "")}`);
  return {};
}

export async function deleteProject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await verifySession();
  const id = String(formData.get("projectId") ?? "");

  const { count } = await prisma.project.deleteMany({ where: { id, userId } });
  if (count === 0) return { error: "That project could not be found." };

  redirect("/projects");
}
