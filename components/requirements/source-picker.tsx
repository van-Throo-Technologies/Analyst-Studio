"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { SOURCE_TYPE_LABELS, type SourceType } from "@/lib/schemas/enums";

export type SourceOption = { id: string; title: string; sourceType: SourceType };

/**
 * Source linking, present on every entity form.
 *
 * It is a checkbox list rather than a searchable picker because a project has a
 * handful of sources, not hundreds — and because the point is to make linking
 * so cheap that "no source" is always a deliberate choice rather than the path
 * of least resistance.
 */
export function SourcePicker({
  sources,
  selected,
  name = "sourceRefs",
  label = "Sources",
}: {
  sources: SourceOption[];
  selected: string[];
  name?: string;
  label?: string;
}) {
  const [value, setValue] = useState<string[]>(selected);

  if (sources.length === 0) {
    return (
      <p className="text-xs text-ink-faint">
        No sources stored yet — add discovery material to link this back to it.
      </p>
    );
  }

  function toggle(id: string) {
    setValue((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  }

  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-medium text-ink-soft">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((source) => {
          const checked = value.includes(source.id);
          return (
            <label
              key={source.id}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 text-xs transition-colors",
                checked
                  ? "border-accent-line bg-accent-soft text-accent"
                  : "border-line text-ink-muted hover:border-line-strong hover:text-ink",
              )}
              title={SOURCE_TYPE_LABELS[source.sourceType]}
            >
              <input
                type="checkbox"
                name={name}
                value={source.id}
                checked={checked}
                onChange={() => toggle(source.id)}
                className="sr-only"
              />
              <span aria-hidden>{checked ? "✓" : "+"}</span>
              {source.title}
            </label>
          );
        })}
      </div>
      {value.length === 0 ? (
        <p className="text-xs text-warning">
          Not linked to any source. The quality checks will flag this.
        </p>
      ) : null}
    </fieldset>
  );
}
