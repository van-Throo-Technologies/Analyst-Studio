"use client";

import { useActionState } from "react";
import { runExtraction, type ActionState } from "../lib/actions";
import styles from "./ExtractionButton.module.css";

export function ExtractionButton({
  projectId,
  documentCount,
  hasRequirements,
}: {
  projectId: string;
  documentCount: number;
  hasRequirements: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    runExtraction,
    {},
  );

  const disabled = pending || documentCount === 0;

  return (
    <div className={styles.wrap}>
      <form action={formAction}>
        <input type="hidden" name="projectId" value={projectId} />
        <button type="submit" className={styles.button} disabled={disabled}>
          {pending && <span className={styles.spinner} aria-hidden="true" />}
          {pending
            ? "Reading the material…"
            : hasRequirements
              ? "Re-run extraction"
              : "Extract requirements"}
        </button>
      </form>

      <p className={styles.note}>
        {documentCount === 0
          ? "Add source material first."
          : hasRequirements
            ? "Re-running replaces the requirements below."
            : "Reads every document in this project."}
      </p>

      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}
