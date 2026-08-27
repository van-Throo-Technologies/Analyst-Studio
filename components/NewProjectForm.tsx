"use client";

import { useActionState } from "react";
import { createProject, type ActionState } from "../lib/actions";
import { INDUSTRIES, INDUSTRY_LABELS, DEFAULT_INDUSTRY } from "../lib/constants";
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

        <div className={styles.row}>
          {/* No blank option: the select always holds a real value, so a
              project can never be created without an industry. */}
          <label htmlFor="industry" className={styles.srOnly}>
            Industry
          </label>
          <select
            id="industry"
            name="industry"
            defaultValue={DEFAULT_INDUSTRY}
            className={styles.select}
          >
            {INDUSTRIES.map((industry) => (
              <option key={industry} value={industry}>
                {INDUSTRY_LABELS[industry]}
              </option>
            ))}
          </select>

          <button type="submit" className={styles.button} disabled={pending}>
            {pending ? "Creating…" : "Create project"}
          </button>
        </div>
      </form>

      {/* Says why the choice matters and that it is final — cheaper to read now
          than to discover after extraction has run against the wrong one. */}
      <p className={styles.hint}>
        Industry shapes how requirements are extracted and checked. It cannot be
        changed later.
      </p>

      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}
