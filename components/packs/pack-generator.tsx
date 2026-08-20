"use client";

import { useActionState, useState } from "react";
import { generatePackAction } from "@/app/projects/[id]/packs/actions";
import type { FormState } from "@/lib/forms";
import type { AnalysisMode } from "@/lib/schemas/enums";
import { cn, pluralize } from "@/lib/utils";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  FormError,
} from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";

export type PackReadiness = {
  requirements: number;
  useCasesHighLevel: number;
  useCasesDetailed: number;
  businessCriteria: number;
  functionalCriteria: number;
  stakeholders: number;
  goals: number;
  rules: number;
  pendingInsights: number;
};

/**
 * The BA/FA toggle, with an honest readiness picture for each mode.
 *
 * The two packs draw on different parts of the model, so a project can be ready
 * for one and thin for the other. Showing that before the analyst spends a
 * generation is more useful than letting them discover it in the preview.
 */
export function PackGenerator({
  projectId,
  defaultMode,
  aiConfigured,
  readiness,
}: {
  projectId: string;
  defaultMode: AnalysisMode;
  aiConfigured: boolean;
  readiness: PackReadiness;
}) {
  const [mode, setMode] = useState<AnalysisMode>(defaultMode);
  const [state, formAction] = useActionState<FormState, FormData>(
    generatePackAction.bind(null, projectId),
    null,
  );

  const checks =
    mode === "BA"
      ? [
          { label: "Requirements", value: readiness.requirements, needed: true },
          { label: "Business goals", value: readiness.goals, needed: true },
          { label: "Stakeholders", value: readiness.stakeholders, needed: false },
          { label: "Business rules", value: readiness.rules, needed: false },
          {
            label: "High-level use cases",
            value: readiness.useCasesHighLevel,
            needed: false,
          },
          {
            label: "Business acceptance criteria",
            value: readiness.businessCriteria,
            needed: false,
          },
        ]
      : [
          { label: "Requirements", value: readiness.requirements, needed: true },
          {
            label: "Detailed use cases",
            value: readiness.useCasesDetailed,
            needed: true,
          },
          {
            label: "Functional acceptance criteria",
            value: readiness.functionalCriteria,
            needed: true,
          },
          { label: "Business rules", value: readiness.rules, needed: false },
        ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate a pack</CardTitle>
        <div
          role="radiogroup"
          aria-label="Analysis mode"
          className="flex rounded-md border border-line-strong p-0.5"
        >
          {(["BA", "FA"] as AnalysisMode[]).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                mode === value
                  ? "bg-accent text-white"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardBody>
        <p className="mb-4 text-sm text-ink-muted">
          {mode === "BA"
            ? "The BA pack answers why this work is happening, who it affects, and what has to be true. It draws on your goals, stakeholders, rules, business requirements and high-level use cases."
            : "The FA pack answers what the solution must do and how it must behave. It draws on your functional and non-functional requirements, detailed use cases, dependencies and functional criteria."}
        </p>

        <ul className="mb-4 grid gap-1.5 sm:grid-cols-2">
          {checks.map((check) => {
            const missing = check.value === 0;
            return (
              <li
                key={check.label}
                className="flex items-center justify-between gap-2 border-b border-line pb-1 text-sm"
              >
                <span className="text-ink-soft">{check.label}</span>
                <span
                  className={cn(
                    "tabular-nums",
                    missing && check.needed
                      ? "text-critical"
                      : missing
                        ? "text-warning"
                        : "text-ink",
                  )}
                >
                  {check.value}
                  {missing ? (check.needed ? " — required" : " — thin") : ""}
                </span>
              </li>
            );
          })}
        </ul>

        {readiness.pendingInsights > 0 ? (
          <p className="mb-4 rounded-md border border-warning-line bg-warning-soft px-3 py-2 text-sm text-warning">
            {pluralize(readiness.pendingInsights, "extracted insight")} still awaiting
            review. Anything unreviewed is excluded from the pack, and the gap is noted
            in the open questions.
          </p>
        ) : null}

        {!aiConfigured ? (
          <p className="mb-4 rounded-md border border-line-strong bg-surface-muted px-3 py-2 text-sm text-ink-muted">
            Without an API key the pack is still generated in full — every requirement,
            rule, use case and criterion is included exactly as stored. Only the narrative
            sections are left unwritten, and they say so.
          </p>
        ) : null}

        <form action={formAction} className="flex flex-wrap items-center gap-3">
          {state && !state.ok ? <FormError message={state.message} /> : null}
          <input type="hidden" name="mode" value={mode} />
          <SubmitButton
            pendingLabel={aiConfigured ? "Writing the pack…" : "Assembling…"}
            disabled={readiness.requirements === 0}
          >
            Generate {mode} pack
          </SubmitButton>
          {readiness.requirements === 0 ? (
            <span className="text-xs text-ink-faint">
              Add at least one requirement first.
            </span>
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}
