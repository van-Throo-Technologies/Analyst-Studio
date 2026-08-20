"use client";

import { useActionState, useState } from "react";
import { validateSourceAction } from "@/app/projects/[id]/sources/actions";
import type { FormState } from "@/lib/forms";
import { Button, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";

type Decision = "validate" | "reject";

/**
 * The validate / reject control as it appears on a row of the intake list.
 *
 * The same decision can be made from the source's own page, where there is room
 * to read the material first. This exists because the common case is a person
 * working down a list of sources they already know, and making them open four
 * pages to clear four rows is the kind of friction that leaves everything
 * sitting at "pending" forever.
 *
 * It lives inside the row but outside the row's link — a form nested in an
 * anchor is invalid HTML, and clicking "Reject" must not navigate.
 */
export function SourceValidationControl({
  projectId,
  sourceId,
  compact = false,
}: {
  projectId: string;
  sourceId: string;
  /** Renders as quieter, smaller controls for a list row. */
  compact?: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    validateSourceAction.bind(null, projectId, sourceId),
    null,
  );
  const [decision, setDecision] = useState<Decision | null>(null);

  // Close the form once the decision it was opened for has been recorded.
  const [handled, setHandled] = useState<FormState>(null);
  if (state?.ok && state !== handled) {
    setHandled(state);
    setDecision(null);
  }

  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const size = compact ? "sm" : "md";

  if (decision === null) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size={size} variant="primary" onClick={() => setDecision("validate")}>
          Validate
        </Button>
        <Button size={size} onClick={() => setDecision("reject")}>
          Reject
        </Button>
        {state && !state.ok ? (
          <span className="text-[11px] text-critical">{state.message}</span>
        ) : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="w-full space-y-1.5">
      <input type="hidden" name="validationAction" value={decision} />
      <Textarea
        name="validationNotes"
        rows={2}
        maxLength={1000}
        className="text-xs"
        placeholder={
          decision === "reject"
            ? "Why is it unreliable? Required."
            : "Optional — what you checked it against."
        }
      />
      {errors.validationNotes ? (
        <p className="text-[11px] text-critical">{errors.validationNotes}</p>
      ) : state && !state.ok ? (
        <p className="text-[11px] text-critical">{state.message}</p>
      ) : null}
      <div className="flex items-center gap-1.5">
        <SubmitButton
          size={size}
          variant={decision === "validate" ? "primary" : "danger"}
          pendingLabel="Saving…"
        >
          {decision === "validate" ? "Confirm validation" : "Confirm rejection"}
        </SubmitButton>
        <Button size={size} onClick={() => setDecision(null)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
