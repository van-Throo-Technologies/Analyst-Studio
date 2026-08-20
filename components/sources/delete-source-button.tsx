"use client";

import { useState } from "react";
import { deleteSourceAction } from "@/app/projects/[id]/sources/actions";
import { Button } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { pluralize } from "@/lib/utils";

/**
 * Deleting a source also deletes everything extracted from it, so the confirm
 * step spells out the count rather than showing a generic "are you sure".
 */
export function DeleteSourceButton({
  projectId,
  sourceId,
  insightCount,
}: {
  projectId: string;
  sourceId: string;
  insightCount: number;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant="danger" onClick={() => setConfirming(true)}>
        Delete
      </Button>
    );
  }

  return (
    <form
      action={deleteSourceAction.bind(null, projectId, sourceId)}
      className="flex items-center gap-2"
    >
      <span className="text-xs text-ink-muted">
        {insightCount > 0
          ? `Also deletes ${pluralize(insightCount, "extracted insight")}.`
          : "This cannot be undone."}
      </span>
      <SubmitButton variant="danger" pendingLabel="Deleting…">
        Delete
      </SubmitButton>
      <Button onClick={() => setConfirming(false)}>Cancel</Button>
    </form>
  );
}
