"use client";

import { useActionState, useState } from "react";
import {
  createRequirementAction,
  updateRequirementAction,
} from "@/app/projects/[id]/requirements/actions";
import type { FormState } from "@/lib/forms";
import { linesToText } from "@/lib/forms";
import type { Requirement } from "@/lib/schemas/entities";
import {
  PRIORITY_LABELS,
  REQUIREMENT_STATUS_LABELS,
  REQUIREMENT_TYPE_LABELS,
  prioritySchema,
  requirementStatusSchema,
  requirementTypeSchema,
} from "@/lib/schemas/enums";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  FormError,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { SourcePicker, type SourceOption } from "@/components/requirements/source-picker";

export function RequirementForm({
  projectId,
  requirement,
  sources,
  onDone,
}: {
  projectId: string;
  /** Omit to create. */
  requirement?: Requirement;
  sources: SourceOption[];
  onDone?: () => void;
}) {
  const editing = requirement !== undefined;
  const [state, formAction] = useActionState<FormState, FormData>(
    editing
      ? updateRequirementAction.bind(null, projectId, requirement.id)
      : createRequirementAction.bind(null, projectId),
    null,
  );
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.ok ? <FormError message={state.message} /> : null}
      {state?.ok && state.message ? (
        <p className="rounded-md border border-positive-line bg-positive-soft px-3 py-2 text-sm text-positive">
          {state.message}
        </p>
      ) : null}

      <Field label="Title" htmlFor="title" required error={errors.title}>
        <Input
          id="title"
          name="title"
          required
          maxLength={200}
          defaultValue={requirement?.title}
          placeholder="Policyholder can submit a claim without a policy number"
        />
      </Field>

      <Field
        label="Description"
        htmlFor="description"
        error={errors.description}
        hint="What has to be true, for whom, under what conditions. Unambiguous enough to build and test against."
      >
        <Textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={requirement?.description}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Type" htmlFor="requirementType" error={errors.requirementType}>
          <Select
            id="requirementType"
            name="requirementType"
            defaultValue={requirement?.requirementType ?? "functional"}
          >
            {requirementTypeSchema.options.map((value) => (
              <option key={value} value={value}>
                {REQUIREMENT_TYPE_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Priority" htmlFor="priority" error={errors.priority}>
          <Select
            id="priority"
            name="priority"
            defaultValue={requirement?.priority ?? "medium"}
          >
            {prioritySchema.options.map((value) => (
              <option key={value} value={value}>
                {PRIORITY_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Status" htmlFor="status" error={errors.status}>
          <Select
            id="status"
            name="status"
            defaultValue={requirement?.status ?? "draft"}
          >
            {requirementStatusSchema.options.map((value) => (
              <option key={value} value={value}>
                {REQUIREMENT_STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Owner"
          htmlFor="owner"
          error={errors.owner}
          hint="Who decides whether this is right."
        >
          <Input id="owner" name="owner" defaultValue={requirement?.owner} />
        </Field>

        <Field
          label="Rationale"
          htmlFor="rationale"
          error={errors.rationale}
          hint="Why this is needed, in business terms."
        >
          <Input id="rationale" name="rationale" defaultValue={requirement?.rationale} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Assumptions"
          htmlFor="assumptions"
          hint="One per line. Things taken as true but not established."
        >
          <Textarea
            id="assumptions"
            name="assumptions"
            rows={3}
            defaultValue={linesToText(requirement?.assumptions ?? [])}
          />
        </Field>

        <Field
          label="Constraints"
          htmlFor="constraints"
          hint="One per line. Fixed limits this must respect."
        >
          <Textarea
            id="constraints"
            name="constraints"
            rows={3}
            defaultValue={linesToText(requirement?.constraints ?? [])}
          />
        </Field>
      </div>

      <SourcePicker sources={sources} selected={requirement?.sourceRefs ?? []} />

      <div className="flex items-center gap-2">
        <SubmitButton pendingLabel="Saving…">
          {editing ? "Save requirement" : "Create requirement"}
        </SubmitButton>
        {onDone ? <Button onClick={onDone}>Cancel</Button> : null}
      </div>
    </form>
  );
}

/** Collapsed "new requirement" card used at the top of the list. */
export function NewRequirementCard({
  projectId,
  sources,
}: {
  projectId: string;
  sources: SourceOption[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>
        Add requirement
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New requirement</CardTitle>
      </CardHeader>
      <CardBody>
        <RequirementForm
          projectId={projectId}
          sources={sources}
          onDone={() => setOpen(false)}
        />
      </CardBody>
    </Card>
  );
}
