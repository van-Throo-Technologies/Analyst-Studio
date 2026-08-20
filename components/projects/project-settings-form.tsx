"use client";

import { useActionState, useState } from "react";
import { deleteProjectAction, updateProjectAction } from "@/app/projects/actions";
import type { FormState } from "@/lib/forms";
import type { Project } from "@/lib/schemas/entities";
import {
  PROJECT_STATUS_LABELS,
  projectStatusSchema,
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
import { ModeChoice } from "@/components/projects/mode-choice";
import { DomainContextFields } from "@/components/projects/domain-context-fields";
import { ScenarioChoice } from "@/components/projects/scenario-choice";

export function ProjectSettingsForm({ project }: { project: Project }) {
  const [state, formAction] = useActionState<FormState, FormData>(
    updateProjectAction.bind(null, project.id),
    null,
  );
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-5">
        {state && !state.ok ? <FormError message={state.message} /> : null}
        {state?.ok && state.message ? (
          <p className="rounded-md border border-positive-line bg-positive-soft px-3 py-2 text-sm text-positive">
            {state.message}
          </p>
        ) : null}

        <Card>
          <CardBody className="space-y-5">
            <Field label="Project name" htmlFor="name" required error={errors.name}>
              <Input
                id="name"
                name="name"
                required
                maxLength={120}
                defaultValue={project.name}
              />
            </Field>

            <Field label="Short description" htmlFor="description" error={errors.description}>
              <Textarea
                id="description"
                name="description"
                rows={2}
                defaultValue={project.description}
              />
            </Field>

            <Field
              label="Analysis goal"
              htmlFor="analysisGoal"
              error={errors.analysisGoal}
              hint="What this analysis has to deliver."
            >
              <Textarea
                id="analysisGoal"
                name="analysisGoal"
                rows={3}
                defaultValue={project.analysisGoal}
              />
            </Field>

            <Field
              label="Status"
              htmlFor="status"
              error={errors.status}
              hint="Shown in the project list. Purely for your own tracking."
              className="max-w-xs"
            >
              <Select id="status" name="status" defaultValue={project.status}>
                {projectStatusSchema.options.map((value) => (
                  <option key={value} value={value}>
                    {PROJECT_STATUS_LABELS[value]}
                  </option>
                ))}
              </Select>
            </Field>
          </CardBody>
        </Card>

        <DomainContextFields project={project} errors={errors} />

        <ScenarioChoice
          name="scenarioType"
          defaultValue={project.scenarioType}
          error={errors.scenarioType}
        />

        <ModeChoice
          name="defaultMode"
          defaultValue={project.defaultMode}
          error={errors.defaultMode}
        />

        <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton>
      </form>

      <DangerZone projectId={project.id} projectName={project.name} />
    </div>
  );
}

function DangerZone({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <Card className="border-critical-line">
      <CardHeader className="border-critical-line">
        <CardTitle className="text-critical">Delete project</CardTitle>
      </CardHeader>
      <CardBody>
        <p className="text-sm text-ink-muted">
          Permanently removes <span className="font-medium text-ink">{projectName}</span>{" "}
          along with every source, extracted insight, requirement, use case, pack and AI
          generation record. This cannot be undone.
        </p>
        {confirming ? (
          <form action={deleteProjectAction.bind(null, projectId)} className="mt-3 flex gap-2">
            <SubmitButton variant="danger" size="sm" pendingLabel="Deleting…">
              Yes, delete everything
            </SubmitButton>
            <Button size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <Button
            variant="danger"
            size="sm"
            className="mt-3"
            onClick={() => setConfirming(true)}
          >
            Delete project
          </Button>
        )}
      </CardBody>
    </Card>
  );
}
