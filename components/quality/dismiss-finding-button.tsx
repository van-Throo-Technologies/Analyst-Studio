"use client";

import { dismissFindingAction } from "@/app/projects/[id]/quality/actions";
import { SubmitButton } from "@/components/ui/submit-button";

export function DismissFindingButton({
  projectId,
  findingId,
}: {
  projectId: string;
  findingId: string;
}) {
  return (
    <form action={dismissFindingAction.bind(null, projectId, findingId)}>
      <SubmitButton
        size="sm"
        variant="ghost"
        pendingLabel="…"
        title="Hide this finding. It stays on record as considered and rejected."
      >
        Dismiss
      </SubmitButton>
    </form>
  );
}
