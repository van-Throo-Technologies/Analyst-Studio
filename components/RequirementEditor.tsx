"use client";

import { useActionState, useState } from "react";
import {
  updateRequirement,
  deleteRequirement,
  type ActionState,
} from "../lib/actions";
import { REQUIREMENT_TYPES, PRIORITIES } from "../lib/constants";
import styles from "./RequirementEditor.module.css";

type Editable = {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  actor: string | null;
  trigger: string | null;
  happyPath: string | null;
  alternateFlows: string | null;
  bdDAC: string | null;
  checklistAC: string | null;
  validationGates: string | null;
  completionScore: number;
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>
        {label}
        {hint && <span className={styles.hint}> — {hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function RequirementEditor({
  requirement,
  projectId,
}: {
  requirement: Editable;
  projectId: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await updateRequirement(prev, formData);
      if (!result.error) setOpen(false);
      return result;
    },
    {},
  );
  const [removeState, removeAction, removing] = useActionState<ActionState, FormData>(
    deleteRequirement,
    {},
  );

  if (!open) {
    return (
      <div className={styles.bar}>
        <button type="button" className={styles.edit} onClick={() => setOpen(true)}>
          Edit
        </button>
        <form
          action={removeAction}
          onSubmit={(event) => {
            if (!window.confirm(`Delete "${requirement.title}"? This cannot be undone.`)) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="requirementId" value={requirement.id} />
          <input type="hidden" name="projectId" value={projectId} />
          <button type="submit" className={styles.delete} disabled={removing}>
            {removing ? "Deleting…" : "Delete"}
          </button>
        </form>
        {removeState.error && (
          <span className={styles.error} role="alert">
            {removeState.error}
          </span>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="requirementId" value={requirement.id} />
      <input type="hidden" name="projectId" value={projectId} />

      <Field label="Title">
        <input
          name="title"
          defaultValue={requirement.title}
          required
          className={styles.input}
        />
      </Field>

      <Field label="Description">
        <textarea
          name="description"
          rows={3}
          defaultValue={requirement.description}
          className={styles.textarea}
        />
      </Field>

      <div className={styles.row}>
        <Field label="Type">
          <select name="type" defaultValue={requirement.type} className={styles.select}>
            {REQUIREMENT_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Priority">
          <select
            name="priority"
            defaultValue={requirement.priority}
            className={styles.select}
          >
            {PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Specified %">
          <input
            name="completionScore"
            type="number"
            min={0}
            max={100}
            step={1}
            defaultValue={requirement.completionScore}
            className={styles.input}
          />
        </Field>
      </div>

      <div className={styles.row}>
        <Field label="Actor">
          <input
            name="actor"
            defaultValue={requirement.actor ?? ""}
            className={styles.input}
          />
        </Field>
        <Field label="Trigger">
          <input
            name="trigger"
            defaultValue={requirement.trigger ?? ""}
            className={styles.input}
          />
        </Field>
      </div>

      <Field label="Happy path">
        <textarea
          name="happyPath"
          rows={3}
          defaultValue={requirement.happyPath ?? ""}
          className={styles.textarea}
        />
      </Field>

      {/* These four are stored newline-joined, so the textarea is the honest
          editor for them: one item per line, exactly as rendered. */}
      <Field label="Alternate flows" hint="one per line">
        <textarea
          name="alternateFlows"
          rows={3}
          defaultValue={requirement.alternateFlows ?? ""}
          className={styles.textarea}
        />
      </Field>

      <Field label="Acceptance criteria (Given / When / Then)" hint="one per line">
        <textarea
          name="bdDAC"
          rows={4}
          defaultValue={requirement.bdDAC ?? ""}
          className={styles.textarea}
        />
      </Field>

      <Field label="Acceptance checklist" hint="one per line">
        <textarea
          name="checklistAC"
          rows={3}
          defaultValue={requirement.checklistAC ?? ""}
          className={styles.textarea}
        />
      </Field>

      <Field label="Open questions" hint="one per line">
        <textarea
          name="validationGates"
          rows={3}
          defaultValue={requirement.validationGates ?? ""}
          className={styles.textarea}
        />
      </Field>

      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}

      <div className={styles.actions}>
        <button type="submit" className={styles.save} disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          className={styles.cancel}
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Cancel
        </button>
        <span className={styles.warning}>
          Saving marks this requirement as edited, so re-running extraction will
          leave it alone.
        </span>
      </div>
    </form>
  );
}
