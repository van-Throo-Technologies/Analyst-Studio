"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { AiJobError, AiNotConfiguredError } from "@/lib/ai/client";
import { generatePack } from "@/lib/ai/jobs/generate-pack";
import { regeneratePackSection } from "@/lib/ai/jobs/regenerate-section";
import { text, type FormState } from "@/lib/forms";
import { analysisModeSchema } from "@/lib/schemas/enums";

function revalidateProject(projectId: string): void {
  revalidatePath(`/projects/${projectId}`, "layout");
}

export async function generatePackAction(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const mode = analysisModeSchema.safeParse(text(formData, "mode"));
  if (!mode.success) return { ok: false, message: "Pick BA or FA." };

  let packId: string;
  try {
    const result = await generatePack(projectId, mode.data);
    packId = result.packId;

    if (result.narrativeSource === "model_only") {
      revalidateProject(projectId);
      redirect(`/projects/${projectId}/packs?pack=${packId}&narrative=missing`);
    }
  } catch (error) {
    if (error instanceof AiNotConfiguredError || error instanceof AiJobError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof Error && !isRedirectError(error)) {
      return { ok: false, message: error.message };
    }
    throw error;
  }

  revalidateProject(projectId);
  redirect(`/projects/${projectId}/packs?pack=${packId}`);
}

export async function regenerateSectionAction(
  projectId: string,
  packId: string,
  section: string,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  try {
    const { refreshedFromModel } = await regeneratePackSection(
      projectId,
      packId,
      section,
    );
    revalidateProject(projectId);
    return {
      ok: true,
      message: refreshedFromModel
        ? "Section refreshed from the current model."
        : "Section rewritten.",
    };
  } catch (error) {
    if (error instanceof AiNotConfiguredError || error instanceof AiJobError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof Error) return { ok: false, message: error.message };
    throw error;
  }
}

export async function deletePackAction(
  projectId: string,
  packId: string,
): Promise<void> {
  await prisma.packOutput.delete({ where: { id: packId, projectId } });
  revalidateProject(projectId);
  redirect(`/projects/${projectId}/packs`);
}

/** `redirect()` throws a control-flow error that must not be swallowed. */
function isRedirectError(error: Error): boolean {
  return "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT");
}
