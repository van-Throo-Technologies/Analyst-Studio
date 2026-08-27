"use client";

import { useActionState } from "react";
import { deleteProject, type ActionState } from "../lib/actions";
import styles from "./DeleteProjectButton.module.css";

export function DeleteProjectButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    deleteProject,
    {},
  );

  return (
    <form
      action={formAction}
      // Deleting cascades to every document and requirement in the project and
      // cannot be undone, so it asks first.
      onSubmit={(event) => {
        const ok = window.confirm(
          `Delete "${projectName}"? Its documents and requirements go with it. This cannot be undone.`,
        );
        if (!ok) event.preventDefault();
      }}
    >
      <input type="hidden" name="projectId" value={projectId} />
      <button type="submit" className={styles.button} disabled={pending}>
        {pending ? "Deleting…" : "Delete project"}
      </button>
      {state.error && (
        <span className={styles.error} role="alert">
          {state.error}
        </span>
      )}
    </form>
  );
}
