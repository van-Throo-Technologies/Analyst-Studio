"use client";

import { useActionState, useState } from "react";
import {
  createUseCaseAction,
  deleteUseCaseAction,
  updateUseCaseAction,
} from "@/app/projects/[id]/requirements/actions";
import type { FormState } from "@/lib/forms";
import { linesToText } from "@/lib/forms";
import type { FlowBranch, UseCase } from "@/lib/schemas/entities";
import { SCOPE_LEVEL_LABELS, scopeLevelSchema } from "@/lib/schemas/enums";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  FormError,
  Input,
  Ref,
  Select,
  Textarea,
} from "@/components/ui";
import { ScopeLevelBadge } from "@/components/ui/badges";
import { SubmitButton } from "@/components/ui/submit-button";
import { SourcePicker, type SourceOption } from "@/components/requirements/source-picker";

export type RequirementOption = { id: string; ref: string; title: string };

export function UseCasePanel({
  projectId,
  useCases,
  requirements,
  sources,
  /** When set, the panel is embedded in a requirement detail page. */
  scopedRequirementId,
}: {
  projectId: string;
  useCases: UseCase[];
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
          <h2 className="text-sm font-semibold text-ink">Use cases</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-ink-muted">
            High-level use cases describe the interaction; detailed ones add the
            preconditions, alternate and exception flows a delivery team needs.
          </p>
        </div>
        {!adding ? (
          <Button variant="primary" onClick={() => setAdding(true)}>
            Add use case
          </Button>
        ) : null}
      </div>

      {adding ? (
        <Card>
          <CardHeader>
            <CardTitle>New use case</CardTitle>
          </CardHeader>
          <CardBody>
            <UseCaseForm
              projectId={projectId}
              requirements={requirements}
              sources={sources}
              scopedRequirementId={scopedRequirementId}
              onDone={() => setAdding(false)}
            />
          </CardBody>
        </Card>
      ) : null}

      {useCases.length === 0 && !adding ? (
        <EmptyState
          title="No use cases yet"
          description="Add one for each meaningful interaction, or draft one from a requirement on its detail page."
        />
      ) : (
        <div className="space-y-3">
          {useCases.map((useCase) => (
            <Card key={useCase.id}>
              {editingId === useCase.id ? (
                <CardBody>
                  <UseCaseForm
                    projectId={projectId}
                    useCase={useCase}
                    requirements={requirements}
                    sources={sources}
                    scopedRequirementId={scopedRequirementId}
                    onDone={() => setEditingId(null)}
                  />
                </CardBody>
              ) : (
                <>
                  <CardHeader>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Ref>{useCase.ref}</Ref>
                      <CardTitle>{useCase.title}</CardTitle>
                      <ScopeLevelBadge level={useCase.scopeLevel} />
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(useCase.id)}>
                        Edit
                      </Button>
                      <form action={deleteUseCaseAction.bind(null, projectId, useCase.id)}>
                        <SubmitButton size="sm" variant="ghost" className="text-critical" pendingLabel="…">
                          Delete
                        </SubmitButton>
                      </form>
                    </div>
                  </CardHeader>
                  <CardBody>
                    <UseCaseSummary useCase={useCase} requirements={requirements} />
                  </CardBody>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function UseCaseSummary({
  useCase,
  requirements,
}: {
  useCase: UseCase;
  requirements: RequirementOption[];
}) {
  const parent = requirements.find((r) => r.id === useCase.requirementId);

  return (
    <div className="space-y-3 text-sm">
      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        <Pair label="Primary actor" value={useCase.primaryActor} />
        <Pair label="Trigger" value={useCase.trigger} />
        <Pair
          label="Realises"
          value={parent ? `${parent.ref} — ${parent.title}` : ""}
          warnIfEmpty="Not linked to a requirement"
        />
        <Pair
          label="Supporting actors"
          value={useCase.supportingActors.join(", ")}
        />
      </dl>

      <StepList label="Preconditions" items={useCase.preconditions} />
      <StepList label="Main flow" items={useCase.mainFlow} ordered />
      <StepList label="Postconditions" items={useCase.postconditions} />
      <BranchList label="Alternate flows" branches={useCase.alternateFlows} />
      <BranchList label="Exception flows" branches={useCase.exceptionFlows} />
    </div>
  );
}

function Pair({
  label,
  value,
  warnIfEmpty,
}: {
  label: string;
  value: string;
  warnIfEmpty?: string;
}) {
  return (
    <div className="flex gap-2">
      <dt className="w-32 shrink-0 text-xs uppercase tracking-wide text-ink-faint">
        {label}
      </dt>
      <dd className="min-w-0 text-ink-soft">
        {value.trim() ? (
          value
        ) : (
          <span className={warnIfEmpty ? "text-warning" : "text-ink-faint"}>
            {warnIfEmpty ?? "—"}
          </span>
        )}
      </dd>
    </div>
  );
}

function StepList({
  label,
  items,
  ordered,
}: {
  label: string;
  items: string[];
  ordered?: boolean;
}) {
  if (items.length === 0) return null;
  const List = ordered ? "ol" : "ul";
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p>
      <List
        className={
          ordered
            ? "mt-1 list-decimal space-y-0.5 pl-5 text-ink-soft marker:text-ink-faint"
            : "mt-1 list-disc space-y-0.5 pl-5 text-ink-soft marker:text-ink-faint"
        }
      >
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </List>
    </div>
  );
}

function BranchList({ label, branches }: { label: string; branches: FlowBranch[] }) {
  if (branches.length === 0) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p>
      <ul className="mt-1 space-y-1.5">
        {branches.map((branch, i) => (
          <li key={i}>
            <p className="text-ink">{branch.name}</p>
            {branch.steps.length > 0 ? (
              <ol className="mt-0.5 list-decimal space-y-0.5 pl-5 text-ink-soft marker:text-ink-faint">
                {branch.steps.map((step, j) => (
                  <li key={j}>{step}</li>
                ))}
              </ol>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Flow branches round-trip through one line each: "Name: step; step; step". */
function branchesToText(branches: FlowBranch[]): string {
  return branches
    .map((b) => (b.steps.length > 0 ? `${b.name}: ${b.steps.join("; ")}` : b.name))
    .join("\n");
}

export function UseCaseForm({
  projectId,
  useCase,
  requirements,
  sources,
  scopedRequirementId,
  onDone,
}: {
  projectId: string;
  useCase?: UseCase;
  requirements: RequirementOption[];
  sources: SourceOption[];
  scopedRequirementId?: string;
  onDone: () => void;
}) {
  const editing = useCase !== undefined;
  const [state, formAction] = useActionState<FormState, FormData>(
    editing
      ? updateUseCaseAction.bind(null, projectId, useCase.id)
      : createUseCaseAction.bind(null, projectId),
    null,
  );
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const [scopeLevel, setScopeLevel] = useState(useCase?.scopeLevel ?? "high_level");

  return (
    <form
      action={formAction}
      onSubmit={() => setTimeout(onDone, 0)}
      className="space-y-4"
    >
      {state && !state.ok ? <FormError message={state.message} /> : null}

      <Field label="Title" htmlFor="uc-title" required error={errors.title}>
        <Input
          id="uc-title"
          name="title"
          required
          defaultValue={useCase?.title}
          placeholder="Submit a claim through the portal"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Scope level" htmlFor="uc-scope">
          <Select
            id="uc-scope"
            name="scopeLevel"
            value={scopeLevel}
            onChange={(e) =>
              setScopeLevel(e.target.value as typeof scopeLevel)
            }
          >
            {scopeLevelSchema.options.map((value) => (
              <option key={value} value={value}>
                {SCOPE_LEVEL_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Realises requirement" htmlFor="uc-requirement">
          <Select
            id="uc-requirement"
            name="requirementId"
            defaultValue={useCase?.requirementId ?? scopedRequirementId ?? ""}
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Primary actor" htmlFor="uc-actor" error={errors.primaryActor}>
          <Input
            id="uc-actor"
            name="primaryActor"
            defaultValue={useCase?.primaryActor}
            placeholder="Policyholder"
          />
        </Field>
        <Field label="Trigger" htmlFor="uc-trigger" error={errors.trigger}>
          <Input
            id="uc-trigger"
            name="trigger"
            defaultValue={useCase?.trigger}
            placeholder="The policyholder selects “Report a claim”"
          />
        </Field>
      </div>

      <Field
        label="Supporting actors"
        htmlFor="uc-supporting"
        hint="One per line."
      >
        <Textarea
          id="uc-supporting"
          name="supportingActors"
          rows={2}
          defaultValue={linesToText(useCase?.supportingActors ?? [])}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Preconditions"
          htmlFor="uc-pre"
          hint={
            scopeLevel === "detailed"
              ? "One per line. Required for a detailed use case."
              : "One per line."
          }
        >
          <Textarea
            id="uc-pre"
            name="preconditions"
            rows={3}
            defaultValue={linesToText(useCase?.preconditions ?? [])}
          />
        </Field>
        <Field label="Postconditions" htmlFor="uc-post" hint="One per line.">
          <Textarea
            id="uc-post"
            name="postconditions"
            rows={3}
            defaultValue={linesToText(useCase?.postconditions ?? [])}
          />
        </Field>
      </div>

      <Field
        label="Main flow"
        htmlFor="uc-main"
        hint="One step per line, in order. Numbering is added automatically."
      >
        <Textarea
          id="uc-main"
          name="mainFlow"
          rows={5}
          defaultValue={linesToText(useCase?.mainFlow ?? [])}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Alternate flows"
          htmlFor="uc-alt"
          hint="One per line, as “Name: step; step; step”."
        >
          <Textarea
            id="uc-alt"
            name="alternateFlows"
            rows={3}
            defaultValue={branchesToText(useCase?.alternateFlows ?? [])}
            placeholder="Policy found by postcode: Customer enters postcode; System lists matching policies"
          />
        </Field>
        <Field
          label="Exception flows"
          htmlFor="uc-exc"
          hint="One per line, as “Name: step; step; step”."
        >
          <Textarea
            id="uc-exc"
            name="exceptionFlows"
            rows={3}
            defaultValue={branchesToText(useCase?.exceptionFlows ?? [])}
            placeholder="No matching policy: System records an unmatched claim; Handler is notified"
          />
        </Field>
      </div>

      <SourcePicker sources={sources} selected={useCase?.sourceRefs ?? []} />

      <div className="flex gap-2">
        <SubmitButton pendingLabel="Saving…">
          {editing ? "Save use case" : "Create use case"}
        </SubmitButton>
        <Button onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}
