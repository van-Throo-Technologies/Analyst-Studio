import type { z } from "zod";

/**
 * Shared shape for every server action that backs a form.
 *
 * Actions never throw for user error: they return `{ ok: false, ... }` with a
 * message and per-field errors, and the form re-renders with the user's input
 * intact. Thrown errors are reserved for genuine faults (missing project,
 * AI provider down), which Next surfaces through error.tsx.
 */
export type FormState =
  | { ok: true; message?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }
  | null;

/** Flattens a Zod issue list into the `fieldErrors` shape used above. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    result[key] ??= issue.message;
  }
  return result;
}

export function invalid(error: z.ZodError, message = "Please fix the highlighted fields."): FormState {
  return { ok: false, message, fieldErrors: toFieldErrors(error) };
}

/** Reads a text field from FormData, normalising missing values to "". */
export function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Reads a repeated field (checkbox group, multi-select) as a string array. */
export function textList(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

/**
 * Reads a textarea where each non-empty line is one list item. Used everywhere
 * a domain field is a `string[]` (flow steps, preconditions, assumptions) —
 * typing lines is far faster for an analyst than managing repeater rows.
 */
export function lines(formData: FormData, key: string): string[] {
  return text(formData, key)
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•]\s?/, "").trim())
    .filter((line) => line.length > 0);
}

export function linesToText(values: readonly string[]): string {
  return values.join("\n");
}
