"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui";
import type { AnalysisMode } from "@/lib/schemas/enums";

/**
 * BA vs FA is the single most consequential choice in the product — it decides
 * which pack sections exist and how the AI frames every draft. It gets a
 * two-card explainer rather than a dropdown, so nobody picks it by accident.
 */

const OPTIONS: {
  value: AnalysisMode;
  title: string;
  tagline: string;
  answers: string[];
}[] = [
  {
    value: "BA",
    title: "Business Analysis",
    tagline: "Why are we doing this, and what has to be true?",
    answers: [
      "Business problem and goals",
      "Stakeholders, scope and boundaries",
      "Business rules and high-level use cases",
    ],
  },
  {
    value: "FA",
    title: "Functional Analysis",
    tagline: "What must the solution do, and how must it behave?",
    answers: [
      "Detailed functional requirements",
      "Flows, exceptions and validations",
      "Dependencies and non-functional considerations",
    ],
  },
];

export function ModeChoice({
  name,
  defaultValue,
  error,
}: {
  name: string;
  defaultValue: AnalysisMode;
  error?: string;
}) {
  const [selected, setSelected] = useState<AnalysisMode>(defaultValue);

  return (
    <fieldset>
      <legend className="mb-1 text-xs font-medium text-ink-soft">
        Default output mode
      </legend>
      <p className="mb-2.5 text-xs text-ink-faint">
        Sets which pack this project generates by default. You can switch modes at any
        time — both packs are built from the same requirement model.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const active = selected === option.value;
          return (
            <Card
              key={option.value}
              className={cn(
                "cursor-pointer transition-colors",
                active
                  ? "border-accent ring-1 ring-accent"
                  : "hover:border-line-strong",
              )}
            >
              <CardBody className="py-3.5">
                <label className="flex cursor-pointer gap-2.5">
                  <input
                    type="radio"
                    name={name}
                    value={option.value}
                    checked={active}
                    onChange={() => setSelected(option.value)}
                    className="mt-0.5 accent-accent"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">
                      {option.title}
                      <span className="ml-1.5 font-mono text-xs text-ink-faint">
                        {option.value}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      {option.tagline}
                    </span>
                    <ul className="mt-2 space-y-0.5 text-xs text-ink-faint">
                      {option.answers.map((answer) => (
                        <li key={answer} className="flex gap-1.5">
                          <span aria-hidden>·</span>
                          {answer}
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
