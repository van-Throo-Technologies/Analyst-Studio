"use client";

import { useActionState, useState } from "react";
import {
  createDependencyAction,
  deleteDependencyAction,
} from "@/app/projects/[id]/requirements/actions";
import type { FormState } from "@/lib/forms";
import type { Dependency } from "@/lib/schemas/entities";
import {
  DEPENDENCY_TYPE_LABELS,
  dependencyTypeSchema,
} from "@/lib/schemas/enums";
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
} from "@/components/ui";
import { Badge } from "@/components/ui/badges";
import { SubmitButton } from "@/components/ui/submit-button";
import type { RequirementOption } from "@/components/requirements/use-case-panel";

export function DependencyPanel({
  projectId,
  dependencies,
  requirements,
}: {
  projectId: string;
  dependencies: Dependency[];
  requirements: RequirementOption[];
}) {
  const [adding, setAdding] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(
    createDependencyAction.bind(null, projectId),
    null,
  );
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  const byId = new Map(requirements.map((r) => [r.id, r]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Dependencies</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-ink-muted">
            Relationships between requirements. These carry into the FA pack, where
            they drive sequencing decisions.
          </p>
        </div>
        {!adding && requirements.length >= 2 ? (
          <Button variant="primary" onClick={() => setAdding(true)}>
            Add dependency
          </Button>
        ) : null}
      </div>

      {requirements.length < 2 ? (
        <EmptyState
          title="Not enough requirements yet"
          description="A dependency links two requirements, so you need at least two before this becomes useful."
        />
      ) : (
        <>
          {adding ? (
            <Card>
              <CardHeader>
                <CardTitle>New dependency</CardTitle>
              </CardHeader>
              <CardBody>
                <form
                  action={formAction}
                  onSubmit={() => setTimeout(() => setAdding(false), 0)}
                  className="space-y-3"
                >
                  {state && !state.ok ? <FormError message={state.message} /> : null}

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field
                      label="From"
                      htmlFor="dep-from"
                      error={errors.fromRequirementId}
                    >
                      <Select id="dep-from" name="fromRequirementId" required>
                        {requirements.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.ref} — {r.title}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Relationship" htmlFor="dep-type">
                      <Select id="dep-type" name="dependencyType" defaultValue="depends_on">
                        {dependencyTypeSchema.options.map((value) => (
                          <option key={value} value={value}>
                            {DEPENDENCY_TYPE_LABELS[value]}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="To" htmlFor="dep-to" error={errors.toRequirementId}>
                      <Select id="dep-to" name="toRequirementId" required>
                        {requirements.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.ref} — {r.title}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  <Field label="Notes" htmlFor="dep-notes" hint="Why this relationship exists.">
                    <Input id="dep-notes" name="notes" />
                  </Field>

                  <div className="flex gap-2">
                    <SubmitButton size="sm" pendingLabel="Adding…">
                      Add dependency
                    </SubmitButton>
                    <Button size="sm" onClick={() => setAdding(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardBody>
            </Card>
          ) : null}

          {dependencies.length === 0 && !adding ? (
            <EmptyState
              title="No dependencies recorded"
              description="Add one where a requirement blocks, depends on, relates to or conflicts with another."
            />
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-line">
                {dependencies.map((dependency) => {
                  const from = byId.get(dependency.fromRequirementId);
                  const to = byId.get(dependency.toRequirementId);
                  return (
                    <li
                      key={dependency.id}
                      className="flex items-center gap-3 px-5 py-2.5 text-sm"
                    >
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                        <Ref>{from?.ref ?? "?"}</Ref>
                        <Badge>{DEPENDENCY_TYPE_LABELS[dependency.dependencyType]}</Badge>
                        <Ref>{to?.ref ?? "?"}</Ref>
                        <span className="truncate text-ink-muted">
                          {to?.title ?? "unknown requirement"}
                        </span>
                        {dependency.notes ? (
                          <span className="text-xs text-ink-faint">
                            — {dependency.notes}
                          </span>
                        ) : null}
                      </div>
                      <form
                        action={deleteDependencyAction.bind(null, projectId, dependency.id)}
                      >
                        <SubmitButton
                          size="sm"
                          variant="ghost"
                          className="text-critical"
                          pendingLabel="…"
                        >
                          Remove
                        </SubmitButton>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
