"use client";

import { useState } from "react";
import type { Project } from "@/lib/schemas/entities";
import {
  INDUSTRY_LABELS,
  INDUSTRY_ORDER,
  JURISDICTION_LABELS,
  REGULATORY_SENSITIVITY_HINTS,
  REGULATORY_SENSITIVITY_LABELS,
  jurisdictionSchema,
  regulatorySensitivitySchema,
  type RegulatorySensitivity,
} from "@/lib/schemas/enums";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";

/**
 * Industry context, shared by the create and settings forms.
 *
 * Industry is the only required field here. The rest are optional because a
 * half-known context is still worth capturing, and forcing a guess on
 * jurisdiction or sensitivity would produce confidently wrong values that later
 * phases would then act on.
 */
export function DomainContextFields({
  project,
  errors = {},
}: {
  /** Omit when creating. */
  project?: Project;
  errors?: Record<string, string>;
}) {
  const [sensitivity, setSensitivity] = useState<RegulatorySensitivity>(
    project?.regulatorySensitivity ?? "low",
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Industry context</CardTitle>
        <span className="text-xs text-ink-faint">Shapes analysis from here on</span>
      </CardHeader>
      <CardBody className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Industry"
            htmlFor="industry"
            required
            error={errors.industry}
            hint="The system uses industry context to ask better questions and apply relevant quality checks."
          >
            <Select
              id="industry"
              name="industry"
              required
              defaultValue={project?.industry ?? "other"}
            >
              {INDUSTRY_ORDER.map((value) => (
                <option key={value} value={value}>
                  {INDUSTRY_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Subdomain"
            htmlFor="subdomain"
            error={errors.subdomain}
            hint="The narrower slice you are working in."
          >
            <Input
              id="subdomain"
              name="subdomain"
              defaultValue={project?.subdomain ?? ""}
              placeholder="e.g. retail banking, claims processing"
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Jurisdiction"
            htmlFor="jurisdiction"
            error={errors.jurisdiction}
            hint="Signals which regulatory regimes are in play."
          >
            <Select
              id="jurisdiction"
              name="jurisdiction"
              defaultValue={project?.jurisdiction ?? ""}
            >
              <option value="">— not specified —</option>
              {jurisdictionSchema.options.map((value) => (
                <option key={value} value={value}>
                  {JURISDICTION_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Regulatory sensitivity"
            htmlFor="regulatorySensitivity"
            error={errors.regulatorySensitivity}
            hint={REGULATORY_SENSITIVITY_HINTS[sensitivity]}
          >
            <Select
              id="regulatorySensitivity"
              name="regulatorySensitivity"
              value={sensitivity}
              onChange={(e) =>
                setSensitivity(e.target.value as RegulatorySensitivity)
              }
            >
              {regulatorySensitivitySchema.options.map((value) => (
                <option key={value} value={value}>
                  {REGULATORY_SENSITIVITY_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Solution domain"
          htmlFor="solutionDomain"
          error={errors.solutionDomain}
          hint="The kind of thing being built or changed."
        >
          <Input
            id="solutionDomain"
            name="solutionDomain"
            defaultValue={project?.solutionDomain ?? ""}
            placeholder="e.g. web platform, CRM, workflow automation"
          />
        </Field>

        <Field
          label="Additional notes"
          htmlFor="domainContext"
          error={errors.domainContext}
          hint="Anything the fields above do not capture — existing systems, vocabulary, known obligations."
        >
          <Textarea
            id="domainContext"
            name="domainContext"
            rows={3}
            defaultValue={project?.domainContext ?? ""}
            placeholder="Policy administration runs on Guidewire and must be written to through the existing integration layer only. Claims volume averages 240/week with storm peaks to 700."
          />
        </Field>

        <p className="text-xs text-ink-faint">
          Regulatory sensitivity affects traceability expectations and quality warnings
          in later phases. It does not change what you can do here.
        </p>
      </CardBody>
    </Card>
  );
}
