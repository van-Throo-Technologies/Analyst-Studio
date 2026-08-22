"use client";

import { useActionState, useState } from "react";
import { validateSourceAction } from "@/app/projects/[id]/sources/actions";
import type { FormState } from "@/lib/forms";
import type { SourceDocumentWithUploader } from "@/lib/schemas/entities";
import { VALIDATION_STATUS_HINTS } from "@/lib/schemas/enums";
import { displayNameOr } from "@/lib/auth/display-name";
import { formatDateTime } from "@/lib/utils";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  FormError,
  Textarea,
} from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { ValidationStatusBadge } from "@/components/ui/badges";

type Decision = "validated" | "rejected";

/**
 * Validating a source says "this is a faithful record of what the origin
 * actually said" — not "this is correct", and not "we agree with it". The
 * wording here works hard at that distinction, because a validation that
 * quietly means "approved" would put a stamp on material nobody checked.
 *
 * A rejection requires a reason: the reason is the only part of a rejection
 * that is useful later. A validation does not, because "I read it against the
 * recording and it matches" is often the whole of it.
 */
export function SourceValidation({
  projectId,
  source,
  canValidate,
}: {
  projectId: string;
  source: SourceDocumentWithUploader;
  canValidate: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    validateSourceAction.bind(null, projectId, source.id),
    null,
  );
  const [decision, setDecision] = useState<Decision | null>(null);

  // Close the form once the decision it was opened for has been recorded.
  // Adjusted during render rather than in an effect — React re-runs this
  // component before painting, so the form never flashes on screen after a
  // successful submit. `handled` is what makes it fire once and not loop.
  const [handled, setHandled] = useState<FormState>(null);
  if (state?.ok && state !== handled) {
    setHandled(state);
    setDecision(null);
  }

  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const decided = source.validationStatus !== "pending";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Validation</CardTitle>
        <ValidationStatusBadge status={source.validationStatus} />
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm text-ink-muted">
          {VALIDATION_STATUS_HINTS[source.validationStatus]}
        </p>

        {decided ? (
          <div className="rounded-md border border-line bg-surface-muted px-3.5 py-2.5 text-sm">
            <p className="text-ink-soft">
              {source.validationStatus === "validated" ? "Validated" : "Rejected"} by{" "}
              {displayNameOr(source.validatedBy, "someone no longer on this project")}
              {source.validatedAt ? ` on ${formatDateTime(source.validatedAt)}` : null}.
            </p>
            {source.validationNotes.length > 0 ? (
              <p className="mt-1.5 whitespace-pre-wrap text-ink-muted">
                {source.validationNotes}
              </p>
            ) : null}
          </div>
        ) : null}

        {!canValidate ? (
          <p className="text-xs text-ink-faint">
            Your role on this project does not allow validating sources.
          </p>
        ) : decision === null ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => setDecision("validated")}>
              {decided ? "Change to validated" : "Validate"}
            </Button>
            <Button onClick={() => setDecision("rejected")}>
              {decided ? "Change to rejected" : "Reject"}
            </Button>
            {state?.ok && state.message ? (
              <span className="text-xs text-positive">{state.message}</span>
            ) : null}
          </div>
        ) : (
          <form action={formAction} className="space-y-3">
            {state && !state.ok ? <FormError message={state.message} /> : null}
            <input
              type="hidden"
              name="validationAction"
              value={decision === "validated" ? "validate" : "reject"}
            />

            <Field
              label={decision === "rejected" ? "Why is it unreliable?" : "Notes"}
              htmlFor="validationNotes"
              required={decision === "rejected"}
              error={errors.validationNotes}
              hint={
                decision === "rejected"
                  ? "What is wrong with it as a record — second-hand, incomplete, contradicted by another source. Anything already extracted from it stays, so this is what tells the next person to be careful."
                  : "Optional. What you checked it against, if it is worth knowing."
              }
            >
              <Textarea
                id="validationNotes"
                name="validationNotes"
                rows={3}
                maxLength={1000}
                defaultValue={source.validationNotes}
                placeholder={
                  decision === "rejected"
                    ? "Summarised from memory two months after the workshop; the dates do not match the calendar invite."
                    : "Checked against the recording."
                }
              />
            </Field>

            <div className="flex items-center gap-2">
              <SubmitButton
                variant={decision === "validated" ? "primary" : "danger"}
                pendingLabel="Saving…"
              >
                {decision === "validated" ? "Mark as validated" : "Mark as rejected"}
              </SubmitButton>
              <Button onClick={() => setDecision(null)}>Cancel</Button>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
