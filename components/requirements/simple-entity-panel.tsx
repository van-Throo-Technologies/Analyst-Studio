"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/lib/forms";
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
  Input,
  Textarea,
} from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { SourcePicker, type SourceOption } from "@/components/requirements/source-picker";

/**
 * Business rules, goals, stakeholders and actors are structurally the same
 * thing: one or two text fields plus source links. One panel handles all four,
 * configured by a short field list.
 *
 * The abstraction stops there deliberately — requirements, use cases and
 * criteria have real structure and get purpose-built forms.
 */

export type SimpleField = {
  name: string;
  label: string;
  hint?: string;
  multiline?: boolean;
  required?: boolean;
  placeholder?: string;
};

export type SimpleEntity = {
  id: string;
  /** What shows in the list. */
  primary: string;
  /** Secondary line, may be empty. */
  secondary: string;
  values: Record<string, string>;
  sourceRefs: string[];
};

export function SimpleEntityPanel({
  title,
  description,
  addLabel,
  fields,
  entities,
  sources,
  saveAction,
  deleteAction,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  description?: string;
  addLabel: string;
  fields: SimpleField[];
  entities: SimpleEntity[];
  sources: SourceOption[];
  /**
   * Server actions with projectId already bound. The remaining entityId is
   * bound here on the client — a server action reference survives the RSC
   * boundary, a closure over it would not.
   */
  saveAction: (
    entityId: string | null,
    prev: FormState,
    formData: FormData,
  ) => Promise<FormState>;
  deleteAction: (entityId: string) => Promise<void>;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {description ? (
            <p className="mt-0.5 max-w-2xl text-sm text-ink-muted">{description}</p>
          ) : null}
        </div>
        {!adding ? (
          <Button variant="primary" onClick={() => setAdding(true)}>
            {addLabel}
          </Button>
        ) : null}
      </div>

      {adding ? (
        <Card>
          <CardHeader>
            <CardTitle>{addLabel}</CardTitle>
          </CardHeader>
          <CardBody>
            <EntityForm
              fields={fields}
              sources={sources}
              action={saveAction.bind(null, null)}
              submitLabel="Add"
              onDone={() => setAdding(false)}
            />
          </CardBody>
        </Card>
      ) : null}

      {entities.length === 0 && !adding ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {entities.map((entity) => (
              <li key={entity.id} className="px-5 py-3">
                {editingId === entity.id ? (
                  <EntityForm
                    fields={fields}
                    sources={sources}
                    defaults={entity.values}
                    selectedSources={entity.sourceRefs}
                    action={saveAction.bind(null, entity.id)}
                    submitLabel="Save"
                    onDone={() => setEditingId(null)}
                  />
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">{entity.primary}</p>
                      {entity.secondary ? (
                        <p className="mt-0.5 text-sm text-ink-muted">
                          {entity.secondary}
                        </p>
                      ) : null}
                      <p
                        className={cn(
                          "mt-1 text-[11px]",
                          entity.sourceRefs.length === 0
                            ? "text-warning"
                            : "text-ink-faint",
                        )}
                      >
                        {entity.sourceRefs.length === 0
                          ? "No source linked"
                          : `${entity.sourceRefs.length} source${entity.sourceRefs.length === 1 ? "" : "s"} linked`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(entity.id)}>
                        Edit
                      </Button>
                      <form action={deleteAction.bind(null, entity.id)}>
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
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function EntityForm({
  fields,
  sources,
  defaults = {},
  selectedSources = [],
  action,
  submitLabel,
  onDone,
}: {
  fields: SimpleField[];
  sources: SourceOption[];
  defaults?: Record<string, string>;
  selectedSources?: string[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form
      action={formAction}
      onSubmit={() => setTimeout(onDone, 0)}
      className="space-y-3"
    >
      {state && !state.ok ? <FormError message={state.message} /> : null}

      {fields.map((field) => (
        <Field
          key={field.name}
          label={field.label}
          htmlFor={field.name}
          hint={field.hint}
          required={field.required}
          error={errors[field.name]}
        >
          {field.multiline ? (
            <Textarea
              id={field.name}
              name={field.name}
              rows={2}
              required={field.required}
              placeholder={field.placeholder}
              defaultValue={defaults[field.name] ?? ""}
            />
          ) : (
            <Input
              id={field.name}
              name={field.name}
              required={field.required}
              placeholder={field.placeholder}
              defaultValue={defaults[field.name] ?? ""}
            />
          )}
        </Field>
      ))}

      <SourcePicker sources={sources} selected={selectedSources} />

      <div className="flex gap-2">
        <SubmitButton size="sm" pendingLabel="Saving…">
          {submitLabel}
        </SubmitButton>
        <Button size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
