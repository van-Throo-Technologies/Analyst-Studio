"use client";

import { useActionState, useState } from "react";
import {
  draftCriteriaAction,
  draftRequirementsAction,
  draftUseCaseAction,
} from "@/app/projects/[id]/requirements/ai-actions";
import type { FormState } from "@/lib/forms";
import type { AnalysisMode, ScopeLevel } from "@/lib/schemas/enums";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * AI drafting controls.
 *
 * Each one states what it will do and in which mode before it runs, and the
 * result lands as editable entities rather than as a preview — the analyst
 * reviews it in the same place they would have typed it, which is the only way
 * generated content stays honest.
 */

function Result({ state }: { state: FormState }) {
  if (!state?.message) return null;
  return (
    <span
      className={cn(
        "text-xs",
        state.ok ? "text-positive" : "text-critical",
      )}
    >
      {state.message}
    </span>
  );
}

export function DraftUseCaseButton({
  projectId,
  requirementId,
  mode,
  disabled,
}: {
  projectId: string;
  requirementId: string;
  mode: AnalysisMode;
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    draftUseCaseAction.bind(null, projectId, requirementId),
    null,
  );
  const [scopeLevel, setScopeLevel] = useState<ScopeLevel>(
    mode === "FA" ? "detailed" : "high_level",
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="scopeLevel" value={scopeLevel} />
      <Select
        aria-label="Use case scope level"
        value={scopeLevel}
        onChange={(e) => setScopeLevel(e.target.value as ScopeLevel)}
        className="h-7 w-auto text-xs"
      >
        <option value="high_level">High level</option>
        <option value="detailed">Detailed</option>
      </Select>
      <SubmitButton size="sm" pendingLabel="Drafting…" disabled={disabled}>
        Draft use case
      </SubmitButton>
      <Result state={state} />
    </form>
  );
}

export function DraftCriteriaButton({
  projectId,
  requirementId,
  mode,
  disabled,
}: {
  projectId: string;
  requirementId: string;
  mode: AnalysisMode;
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    draftCriteriaAction.bind(null, projectId, requirementId),
    null,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="mode" value={mode} />
      <SubmitButton size="sm" pendingLabel="Drafting…" disabled={disabled}>
        Draft acceptance criteria ({mode})
      </SubmitButton>
      <Result state={state} />
    </form>
  );
}

export function DraftRequirementsButton({
  projectId,
  mode,
  candidateCount,
  disabled,
}: {
  projectId: string;
  mode: AnalysisMode;
  candidateCount: number;
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    draftRequirementsAction.bind(null, projectId),
    null,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="mode" value={mode} />
      <SubmitButton
        pendingLabel="Drafting requirements…"
        disabled={disabled || candidateCount === 0}
      >
        Draft requirements from {candidateCount} candidate
        {candidateCount === 1 ? "" : "s"}
      </SubmitButton>
      <Result state={state} />
    </form>
  );
}
