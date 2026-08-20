"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui";
import {
  SCENARIO_TYPE_DESCRIPTIONS,
  SCENARIO_TYPE_LABELS,
  scenarioTypeSchema,
  type ScenarioType,
} from "@/lib/schemas/enums";

/**
 * Greenfield vs brownfield.
 *
 * Given the same visual weight as the BA/FA choice because it changes what good
 * intake looks like: greenfield sources arrive first-hand as work happens,
 * brownfield ones are archaeology. Presenting it as a dropdown would hide a
 * decision that shapes how the analyst reads everything that follows.
 */

const IMPLICATIONS: Record<ScenarioType, string[]> = {
  greenfield: [
    "Sources land as decisions are made",
    "Authors are available to ask",
    "Gaps mean a decision has not been taken yet",
  ],
  brownfield: [
    "Sources are exports, tickets and stale documents",
    "Authors may have moved on",
    "Gaps mean the record is incomplete, not the decision",
  ],
};

export function ScenarioChoice({
  name,
  defaultValue,
  error,
}: {
  name: string;
  defaultValue: ScenarioType;
  error?: string;
}) {
  const [selected, setSelected] = useState<ScenarioType>(defaultValue);

  return (
    <fieldset>
      <legend className="mb-1 text-xs font-medium text-ink-soft">
        Scenario
      </legend>
      <p className="mb-2.5 text-xs text-ink-faint">
        How this analysis relates to the work. It sets expectations for what the
        sources will be like and how to read a gap in them.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {scenarioTypeSchema.options.map((value) => {
          const active = selected === value;
          return (
            <Card
              key={value}
              className={cn(
                "cursor-pointer transition-colors",
                active ? "border-accent ring-1 ring-accent" : "hover:border-line-strong",
              )}
            >
              <CardBody className="py-3.5">
                <label className="flex cursor-pointer gap-2.5">
                  <input
                    type="radio"
                    name={name}
                    value={value}
                    checked={active}
                    onChange={() => setSelected(value)}
                    className="mt-0.5 accent-accent"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">
                      {SCENARIO_TYPE_LABELS[value]}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      {SCENARIO_TYPE_DESCRIPTIONS[value]}
                    </span>
                    <ul className="mt-2 space-y-0.5 text-xs text-ink-faint">
                      {IMPLICATIONS[value].map((line) => (
                        <li key={line} className="flex gap-1.5">
                          <span aria-hidden>·</span>
                          {line}
                        </li>
                      ))}
                    </ul>
                  </span>
                </label>
              </CardBody>
            </Card>
          );
        })}
      </div>
      {error ? <p className="mt-1.5 text-xs text-critical">{error}</p> : null}
    </fieldset>
  );
}
