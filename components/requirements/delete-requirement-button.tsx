"use client";

import { useState } from "react";
import { deleteRequirementAction } from "@/app/projects/[id]/requirements/actions";
import { Button } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * Deleting a requirement leaves its use cases and criteria in place, detached.
 * The confirm text says so, because the alternative — a silent cascade — is how
 * analysis work disappears without anyone noticing.
 */
export function DeleteRequirementButton({
  projectId,
  requirementId,
  useCaseCount,
  criteriaCount,
}: {
  projectId: string;
  requirementId: string;
  useCaseCount: number;
  criteriaCount: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const attached = useCaseCount + criteriaCount;

  if (!confirming) {
    return (
      <Button variant="danger" onClick={() => setConfirming(true)}>
        Delete
      </Button>
    );
  }

  return (
    <form
      action={deleteRequirementAction.bind(null, projectId, requirementId)}
      className="flex items-center gap-2"
    >
      <span className="max-w-xs text-xs text-ink-muted">
        {attached > 0
          ? `${useCaseCount} use case${useCaseCount === 1 ? "" : "s"} and ${criteriaCount} criteri${criteriaCount === 1 ? "on" : "a"} will be kept but left unattached.`
          : "This cannot be undone."}
      </span>
      <SubmitButton variant="danger" pendingLabel="Deleting…">
        Delete
      </SubmitButton>
      <Button onClick={() => setConfirming(false)}>Cancel</Button>
    </form>
  );
}
