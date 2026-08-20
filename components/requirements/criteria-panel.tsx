"use client";

import { useActionState, useState } from "react";
import {
  createAcceptanceCriterionAction,
  deleteAcceptanceCriterionAction,
  updateAcceptanceCriterionAction,
} from "@/app/projects/[id]/requirements/actions";
import type { FormState } from "@/lib/forms";
import type { AcceptanceCriterion } from "@/lib/schemas/entities";
import { CRITERION_TYPE_LABELS, criterionTypeSchema } from "@/lib/schemas/enums";
import { cn } from "@/lib/utils";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  FormError,
  Ref,
  Select,
  Textarea,
} from "@/components/ui";
import { CriterionTypeBadge } from "@/components/ui/badges";
import { SubmitButton } from "@/components/ui/submit-button";
import { SourcePicker, type SourceOption } from "@/components/requirements/source-picker";
import type { RequirementOption } from "@/components/requirements/use-case-panel";

export function CriteriaPanel({
  projectId,
  criteria,
  requirements,
  sources,
  scopedRequirementId,
}: {
  projectId: string;
  criteria: AcceptanceCriterion[];
  requirements: RequirementOption[];
  sources: SourceOption[];
  scopedRequirementId?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Acceptance criteria</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-ink-muted">
            A criterion has to be something a tester can mark pass or fail without
            interpreting it. The testability score below is a mechanical check on
            exactly that — not a judgement of whether the criterion is correct.
          </p>
        </div>
        {!adding ? (
          <Button variant="primary" onClick={() => setAdding(true)}>
            Add criterion
          </Button>
        ) : null}
      </div>

      {adding ? (
        <Card>
          <CardHeader>
            <CardTitle>New acceptance criterion</CardTitle>
          </CardHeader>
          <CardBody>
            <CriterionForm
              projectId={projectId}
              requirements={requirements}
              sources={sources}
              scopedRequirementId={scopedRequirementId}
              onDone={() => setAdding(false)}
            />
          </CardBody>
        </Card>
      ) : null}

      {criteria.length === 0 && !adding ? (
        <EmptyState
          title="No acceptance criteria yet"
          description="Without criteria there is no agreed definition of done. Draft them per requirement from the requirement detail page."
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {criteria.map((criterion) => {
              const parent = requirements.find((r) => r.id === criterion.requirementId);
              return (
                <li key={criterion.id} className="px-5 py-3">
                  {editingId === criterion.id ? (
                    <CriterionForm
                      projectId={projectId}
                      criterion={criterion}
                      requirements={requirements}
                      sources={sources}
                      scopedRequirementId={scopedRequirementId}
                      onDone={() => setEditingId(null)}
                    />
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Ref>{criterion.ref}</Ref>
                          <CriterionTypeBadge type={criterion.criterionType} />
                          <TestabilityMeter score={criterion.testabilityScore} />
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-ink">
                          {criterion.text}
                        </p>
                        <p className="mt-1 text-[11px] text-ink-faint">
                          {parent ? (
                            `Verifies ${parent.ref}`
                          ) : (
                            <span className="text-warning">
                              Not attached to a requirement
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(criterion.id)}
                        >
                          Edit
                        </Button>
                        <form
                          action={deleteAcceptanceCriterionAction.bind(
                            null,
                            projectId,
                            criterion.id,
                          )}
                        >
                          <SubmitButton
                            size="sm"
                            variant="ghost"
                            className="text-critical"
                            pendingLabel="…"
                          >
                            Delete
                          </SubmitButton>
                        </form>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

function TestabilityMeter({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const tone =
    score >= 0.6 ? "text-positive" : score >= 0.35 ? "text-warning" : "text-critical";
  const label =
    score >= 0.6 ? "testable" : score >= 0.35 ? "partly testable" : "not testable";

  return (
    <span
      className={cn("text-[11px] tabular-nums", tone)}
      title={`Testability heuristic: ${pct}%. Looks for an observable condition, a definite outcome and a measurable threshold; subtracts for vague qualifiers.`}
    >
      {label} · {pct}%
    </span>
  );
}

export function CriterionForm({
  projectId,
  criterion,
  requirements,
  sources,
  scopedRequirementId,
  onDone,
}: {
  projectId: string;
  criterion?: AcceptanceCriterion;
  requirements: RequirementOption[];
  sources: SourceOption[];
  scopedRequirementId?: string;
  onDone: () => void;
}) {
  const editing = criterion !== undefined;
  const [state, formAction] = useActionState<FormState, FormData>(
    editing
      ? updateAcceptanceCriterionAction.bind(null, projectId, criterion.id)
      : createAcceptanceCriterionAction.bind(null, projectId),
    null,
  );
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form
      action={formAction}
      onSubmit={() => setTimeout(onDone, 0)}
      className="space-y-3"
    >
      {state && !state.ok ? <FormError message={state.message} /> : null}

      <Field
        label="Criterion"
        htmlFor="ac-text"
        required
        error={errors.text}
        hint="A condition and a definite outcome. “Given … when … then …” works well but is not required."
      >
        <Textarea
          id="ac-text"
          name="text"
          rows={3}
          required
          defaultValue={criterion?.text}
          placeholder="Given a submission with no date of loss, when the policyholder submits, then the submission is rejected and the missing field is named."
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type" htmlFor="ac-type">
          <Select
            id="ac-type"
            name="criterionType"
            defaultValue={criterion?.criterionType ?? "functional"}
          >
            {criterionTypeSchema.options.map((value) => (
              <option key={value} value={value}>
                {CRITERION_TYPE_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Verifies requirement" htmlFor="ac-requirement">
          <Select
            id="ac-requirement"
            name="requirementId"
            defaultValue={criterion?.requirementId ?? scopedRequirementId ?? ""}
          >
            <option value="">— none —</option>
            {requirements.map((r) => (
              <option key={r.id} value={r.id}>
                {r.ref} — {r.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <SourcePicker sources={sources} selected={criterion?.sourceRefs ?? []} />

      <div className="flex gap-2">
        <SubmitButton size="sm" pendingLabel="Saving…">
          {editing ? "Save" : "Add criterion"}
        </SubmitButton>
        <Button size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
