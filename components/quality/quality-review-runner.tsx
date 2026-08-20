"use client";

import { useActionState } from "react";
import { runQualityReviewAction } from "@/app/projects/[id]/quality/actions";
import type { FormState } from "@/lib/forms";
import type { AnalysisMode } from "@/lib/schemas/enums";
import { cn } from "@/lib/utils";
import { SubmitButton } from "@/components/ui/submit-button";

export function QualityReviewRunner({
  projectId,
  mode,
  aiConfigured,
}: {
  projectId: string;
  mode: AnalysisMode;
  aiConfigured: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    runQualityReviewAction.bind(null, projectId),
    null,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="mode" value={mode} />
      {state?.message ? (
        <span className={cn("text-xs", state.ok ? "text-positive" : "text-critical")}>
          {state.message}
        </span>
      ) : null}
      <SubmitButton size="sm" pendingLabel="Reviewing…" disabled={!aiConfigured}>
        Run AI review ({mode})
      </SubmitButton>
    </form>
  );
}
