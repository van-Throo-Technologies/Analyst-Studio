"use client";

import { useActionState } from "react";
import { createProject, type ActionState } from "../lib/actions";
import styles from "./NewProjectForm.module.css";

export function NewProjectForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createProject,
    {},
  );

  return (
    <div className={styles.wrap}>
      <form action={formAction} className={styles.form}>
        <label htmlFor="name" className={styles.srOnly}>
          Project name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={120}
          placeholder="New project name…"
          className={styles.input}
        />
        <button type="submit" className={styles.button} disabled={pending}>
          {pending ? "Creating…" : "Create project"}
        </button>
      </form>

      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}
