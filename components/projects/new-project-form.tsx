"use client";

import { useActionState } from "react";
import { createProjectAction } from "@/app/projects/actions";
import type { FormState } from "@/lib/forms";
import {
  Card,
  CardBody,
  Field,
  FormError,
  Input,
  Textarea,
} from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { ModeChoice } from "@/components/projects/mode-choice";
import { DomainContextFields } from "@/components/projects/domain-context-fields";
import { ScenarioChoice } from "@/components/projects/scenario-choice";

export function NewProjectForm() {
  const [state, formAction] = useActionState<FormState, FormData>(
    createProjectAction,
    null,
  );
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className="space-y-5">
      {state && !state.ok ? <FormError message={state.message} /> : null}

      <Card>
        <CardBody className="space-y-5">
          <Field
            label="Project name"
            htmlFor="name"
            required
            error={errors.name}
            hint="How you will recognise it in the project list."
          >
            <Input
              id="name"
              name="name"
              required
              maxLength={120}
              autoFocus
              placeholder="Claims intake redesign"
            />
          </Field>

          <Field
            label="Short description"
            htmlFor="description"
            error={errors.description}
            hint="One or two lines on what this piece of work covers."
          >
            <Textarea
              id="description"
              name="description"
              rows={2}
              placeholder="Replacing the manual claims intake process with a self-service portal."
            />
          </Field>

          <Field
            label="Analysis goal"
            htmlFor="analysisGoal"
            error={errors.analysisGoal}
            hint="What this analysis has to deliver. The AI uses this to decide what matters in your sources."
          >
            <Textarea
              id="analysisGoal"
              name="analysisGoal"
              rows={3}
              placeholder="Define the target intake process and the functional scope for phase one, ready for a build estimate."
            />
          </Field>

        </CardBody>
      </Card>

      <DomainContextFields errors={errors} />

        <ScenarioChoice
          name="scenarioType"
          defaultValue={"greenfield"}
          error={errors.scenarioType}
        />

      <ModeChoice name="defaultMode" defaultValue="BA" error={errors.defaultMode} />

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Creating…">Create project</SubmitButton>
        <p className="text-xs text-ink-faint">
          You can change any of this later in project settings.
        </p>
      </div>
    </form>
  );
}
