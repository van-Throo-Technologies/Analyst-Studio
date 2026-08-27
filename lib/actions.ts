"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Anthropic from "@anthropic-ai/sdk";

import { prisma } from "./prisma";
import { verifySession } from "./dal";
import { extractRequirements } from "./extract";

// Every action re-derives the user from the session and scopes its writes with
// it. An action is a public HTTP endpoint — the fact that the only link to it
// sits on a guarded page protects nothing.

export type ActionState = { error?: string };

const TEXT_TYPES = [".txt", ".md", ".vtt", ".srt", ".csv", ".log"];

export async function createProject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await verifySession();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the project a name." };
  if (name.length > 120) return { error: "That name is too long (120 characters max)." };

  const project = await prisma.project.create({
    data: { name, userId },
  });

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

  let filename: string;
  let mimeType: string;
  let content: string;

  if (file instanceof File && file.size > 0) {
    const lower = file.name.toLowerCase();
    const looksTextual =
      file.type.startsWith("text/") || TEXT_TYPES.some((ext) => lower.endsWith(ext));

    // Content is stored as text and sent to the model as text. A PDF or a .docx
    // read this way is mojibake, so it is refused rather than silently stored.
    if (!looksTextual) {
      return {
        error: "Upload a plain-text transcript (.txt, .md, .vtt, .srt, .csv). PDF and Word are not supported yet.",
      };
    }

    content = await file.text();
    filename = file.name;
    mimeType = file.type || "text/plain";
  } else if (pasted) {
    content = pasted;
    filename = "Pasted notes";
    mimeType = "text/plain";
  } else {
    return { error: "Choose a file or paste some text first." };
  }

  if (!content.trim()) return { error: "That file is empty." };

  await prisma.sourceDocument.create({
    data: { projectId, filename, mimeType, content },
  });

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

export async function runExtraction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await verifySession();
  const projectId = String(formData.get("projectId") ?? "");

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    include: { sourceDocuments: { select: { filename: true, content: true } } },
  });
  if (!project) return { error: "That project could not be found." };
  if (project.sourceDocuments.length === 0) {
    return { error: "Add a transcript before running extraction." };
  }

  let extracted;
  try {
    extracted = await extractRequirements(project.sourceDocuments);
  } catch (error) {
    // Typed SDK errors, most specific first — a rate limit and a bad key need
    // different things from the person reading the message.
    if (error instanceof Anthropic.AuthenticationError) {
      return { error: "The Anthropic API key is missing or invalid." };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return { error: "Rate limited by the API. Wait a moment and try again." };
    }
    if (error instanceof Anthropic.APIError) {
      return { error: `The extraction service returned an error (${error.status}).` };
    }
    return {
      error: error instanceof Error ? error.message : "Extraction failed.",
    };
  }

  if (extracted.length === 0) {
    return { error: "No requirements were found in this material." };
  }

  // Extraction reads the whole document set, so its output is the complete
  // picture — replacing rather than appending is what keeps a re-run from
  // duplicating every requirement. Both statements commit or neither does.
  await prisma.$transaction([
    prisma.requirement.deleteMany({ where: { projectId } }),
    prisma.requirement.createMany({
      data: extracted.map((r) => ({
        projectId,
        title: r.title,
        description: r.description,
        type: r.type,
        priority: r.priority,
        actor: r.actor,
        trigger: r.trigger,
        happyPath: r.happyPath,
        alternateFlows: r.alternateFlows.join("\n") || null,
        bdDAC: r.bddAcceptanceCriteria.join("\n") || null,
        checklistAC: r.checklistAcceptanceCriteria.join("\n") || null,
        completionScore: r.completionScore,
        validationGates: r.validationGates.join("\n") || null,
      })),
    }),
  ]);

  revalidatePath(`/projects/${projectId}`);
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
