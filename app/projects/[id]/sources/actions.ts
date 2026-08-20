"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { AccessDeniedError, requireCapability } from "@/lib/auth/access";
import { recordProjectAudit } from "@/lib/audit/log";
import { invalid, text, type FormState } from "@/lib/forms";
import { contentChecksum } from "@/lib/intake/checksum";
import {
  sourceDocumentInputSchema,
  sourceValidationInputSchema,
} from "@/lib/schemas/entities";
import {
  SOURCE_PROVENANCE_LABELS,
  SOURCE_TYPE_LABELS,
  sourceProvenanceSchema,
  sourceTypeSchema,
} from "@/lib/schemas/enums";
import { formatDate, truncate, wordCount } from "@/lib/utils";

function revalidateProject(projectId: string): void {
  revalidatePath(`/projects/${projectId}`, "layout");
}

/** Turns an AccessDeniedError into a form message; rethrows anything else. */
function denied(error: unknown): FormState {
  if (error instanceof AccessDeniedError) {
    return { ok: false, message: error.message };
  }
  throw error;
}

/**
 * Adds a source document.
 *
 * Named "upload" because that is the user-facing act, but it covers pasted text
 * as well as a converted PDF or DOCX — by the time it gets here everything is
 * text either way.
 *
 * Records who added it and the role they held at the time. The role is
 * denormalised on purpose: people move between roles, and "who was the BA when
 * this landed" must not change when they do.
 */
export async function uploadSourceAction(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let actor;
  try {
    actor = await requireCapability(projectId, "manage_sources");
  } catch (error) {
    return denied(error);
  }

  const parsed = sourceDocumentInputSchema.safeParse({
    title: text(formData, "title"),
    sourceType: text(formData, "sourceType"),
    sourceProvenance: text(formData, "sourceProvenance"),
    sourceTimestamp: text(formData, "sourceTimestamp"),
    content: text(formData, "content"),
  });

  if (!parsed.success) return invalid(parsed.error);

  // Identical material already in this project is refused rather than stored
  // twice. Two copies of the same text produce two sets of insights, and every
  // count downstream — coverage, traceability, "4 of 9 requirements" — starts
  // describing the duplication instead of the discovery.
  const checksumHash = contentChecksum(parsed.data.content);
  const twin = await prisma.sourceDocument.findFirst({
    where: { projectId, checksumHash },
    select: { title: true },
  });
  if (twin) {
    return {
      ok: false,
      message: `This is the same material as “${truncate(twin.title, 60)}”, word for word. Edit that source instead of adding a second copy.`,
    };
  }

  const source = await prisma.sourceDocument.create({
    data: {
      projectId,
      ...parsed.data,
      checksumHash,
      uploadedByUserId: actor.user.id,
      uploaderRole: actor.role,
    },
  });

  await recordProjectAudit({
    projectId,
    userId: actor.user.id,
    action: "source_added",
    entityType: "source_document",
    entityId: source.id,
    changesSummary: `Added “${truncate(source.title, 60)}” (${SOURCE_TYPE_LABELS[parsed.data.sourceType]} via ${SOURCE_PROVENANCE_LABELS[parsed.data.sourceProvenance]}, ${wordCount(parsed.data.content).toLocaleString()} words) as ${actor.role}`,
  });

  revalidateProject(projectId);
  return { ok: true, message: "Source added." };
}

export async function updateSourceAction(
  projectId: string,
  sourceId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let actor;
  try {
    actor = await requireCapability(projectId, "manage_sources");
  } catch (error) {
    return denied(error);
  }

  const parsed = sourceDocumentInputSchema.safeParse({
    title: text(formData, "title"),
    sourceType: text(formData, "sourceType"),
    sourceProvenance: text(formData, "sourceProvenance"),
    sourceTimestamp: text(formData, "sourceTimestamp"),
    content: text(formData, "content"),
  });

  if (!parsed.success) return invalid(parsed.error);

  const before = await prisma.sourceDocument.findUnique({
    where: { id: sourceId, projectId },
  });
  if (!before) return { ok: false, message: "That source no longer exists." };

  const checksumHash = contentChecksum(parsed.data.content);
  // A validation vouches for particular words. Change the words and the
  // vouching no longer applies to what is stored, so the decision is cleared
  // rather than left standing over text nobody validated. Whitespace-only
  // edits do not trip this — see contentChecksum.
  const contentChanged = checksumHash !== before.checksumHash;
  const validationCleared = contentChanged && before.validationStatus !== "pending";

  await prisma.sourceDocument.update({
    where: { id: sourceId, projectId },
    // Uploader attribution is never rewritten on edit — it records who brought
    // the material in, not who last touched it. Edits are in the audit log.
    data: {
      ...parsed.data,
      checksumHash,
      ...(validationCleared
        ? {
            validationStatus: "pending",
            validatedByUserId: null,
            validatedAt: null,
            validationNotes: "",
          }
        : {}),
    },
  });

  const changes = [];
  if (before.title !== parsed.data.title) {
    changes.push({ label: "title", from: before.title, to: parsed.data.title });
  }
  if (before.sourceType !== parsed.data.sourceType) {
    changes.push({
      label: "type",
      from: SOURCE_TYPE_LABELS[sourceTypeSchema.catch("other").parse(before.sourceType)],
      to: SOURCE_TYPE_LABELS[parsed.data.sourceType],
    });
  }
  if (before.sourceProvenance !== parsed.data.sourceProvenance) {
    changes.push({
      label: "provenance",
      from: SOURCE_PROVENANCE_LABELS[
        sourceProvenanceSchema.catch("manual_transcription").parse(before.sourceProvenance)
      ],
      to: SOURCE_PROVENANCE_LABELS[parsed.data.sourceProvenance],
    });
  }
  if (before.sourceTimestamp?.getTime() !== parsed.data.sourceTimestamp?.getTime()) {
    changes.push({
      label: "origin date",
      from: before.sourceTimestamp ? formatDate(before.sourceTimestamp) : "",
      to: parsed.data.sourceTimestamp ? formatDate(parsed.data.sourceTimestamp) : "",
    });
  }
  if (before.content !== parsed.data.content) {
    const delta = wordCount(parsed.data.content) - wordCount(before.content);
    changes.push({
      label: "content",
      from: `${wordCount(before.content).toLocaleString()} words`,
      to: `${wordCount(parsed.data.content).toLocaleString()} words (${delta >= 0 ? "+" : ""}${delta})`,
    });
  }

  await recordProjectAudit({
    projectId,
    userId: actor.user.id,
    action: "source_updated",
    entityType: "source_document",
    entityId: sourceId,
    changes,
    changesSummary:
      changes.length === 0
        ? `Saved “${truncate(parsed.data.title, 60)}” with no changes`
        : `Edited “${truncate(parsed.data.title, 60)}”: ${changes.map((c) => `${c.label} ${c.from} → ${c.to}`).join("; ")}`,
  });

  // A second entry rather than a line inside the edit: clearing a validation is
  // a different fact from editing text, and someone auditing validations should
  // find it by action, not by reading edit summaries.
  if (validationCleared) {
    await recordProjectAudit({
      projectId,
      userId: actor.user.id,
      action: "source_validation_reset",
      entityType: "source_document",
      entityId: sourceId,
      changes: [
        { label: "validation", from: before.validationStatus, to: "pending" },
      ],
      changesSummary: `Validation of “${truncate(parsed.data.title, 60)}” cleared — the content changed after it was ${before.validationStatus}`,
    });
  }

  revalidateProject(projectId);
  return {
    ok: true,
    message: validationCleared
      ? "Source saved. The content changed, so it needs validating again."
      : "Source saved.",
  };
}

/**
 * Records a validation decision on a source.
 *
 * Validation is about the material, not the analysis: it says "this is a
 * faithful record of what the origin actually said", not "this is right". A
 * rejected source is kept — knowing a document was found unreliable is worth
 * having, and anything already extracted from it still has to trace somewhere.
 *
 * Re-deciding is allowed and overwrites the previous decision; every decision
 * is a separate audit entry, so the sequence survives even though only the
 * current verdict is on the row.
 */
export async function validateSourceAction(
  projectId: string,
  sourceId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let actor;
  try {
    actor = await requireCapability(projectId, "validate_sources");
  } catch (error) {
    return denied(error);
  }

  const parsed = sourceValidationInputSchema.safeParse({
    validationAction: text(formData, "validationAction"),
    validationNotes: text(formData, "validationNotes"),
  });

  if (!parsed.success) return invalid(parsed.error);

  const before = await prisma.sourceDocument.findUnique({
    where: { id: sourceId, projectId },
    select: { title: true, validationStatus: true },
  });
  if (!before) return { ok: false, message: "That source no longer exists." };

  const decidedAt = new Date();
  const newStatus = parsed.data.validationAction === "validate" ? "validated" : "rejected";

  await prisma.sourceDocument.update({
    where: { id: sourceId, projectId },
    data: {
      validationStatus: newStatus,
      validatedByUserId: actor.user.id,
      validatedAt: decidedAt,
      validationNotes: parsed.data.validationNotes,
    },
  });

  await recordProjectAudit({
    projectId,
    userId: actor.user.id,
    action: newStatus === "validated" ? "source_validated" : "source_rejected",
    entityType: "source_document",
    entityId: sourceId,
    changes: [
      { label: "validation", from: before.validationStatus, to: newStatus },
    ],
    changesSummary:
      newStatus === "validated"
        ? `Validated “${truncate(before.title, 60)}” as ${actor.role}${parsed.data.validationNotes ? `: ${truncate(parsed.data.validationNotes, 120)}` : ""}`
        : `Rejected “${truncate(before.title, 60)}” as ${actor.role}: ${truncate(parsed.data.validationNotes, 120)}`,
  });

  revalidateProject(projectId);
  return { ok: true, message: `Source ${newStatus}.` };
}

export async function deleteSourceAction(
  projectId: string,
  sourceId: string,
): Promise<void> {
  // Throws on denial: this is reached from a confirm step, and a silent no-op
  // would leave the analyst thinking the source was deleted.
  const actor = await requireCapability(projectId, "manage_sources");

  const source = await prisma.sourceDocument.findUnique({
    where: { id: sourceId, projectId },
    include: { _count: { select: { insights: true } } },
  });

  if (source) {
    // Insights extracted from this source go with it — keeping them would leave
    // entities pointing at a source that no longer exists, which is exactly the
    // broken lineage the traceability view is meant to prevent.
    await prisma.sourceDocument.delete({ where: { id: sourceId, projectId } });

    await recordProjectAudit({
      projectId,
      userId: actor.user.id,
      action: "source_deleted",
      entityType: "source_document",
      entityId: sourceId,
      changesSummary: `Deleted “${truncate(source.title, 60)}”${source._count.insights > 0 ? `, along with ${source._count.insights} extracted insight${source._count.insights === 1 ? "" : "s"}` : ""}`,
    });
  }

  revalidateProject(projectId);
  redirect(`/projects/${projectId}/sources`);
}
