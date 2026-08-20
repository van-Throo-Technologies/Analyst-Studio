"use client";

import { useActionState, useState } from "react";
import { runExtractionAction } from "@/app/projects/[id]/extraction/actions";
import type { FormState } from "@/lib/forms";
import type { AnalysisMode, SourceType, ValidationStatus } from "@/lib/schemas/enums";
import { SOURCE_TYPE_LABELS, VALIDATION_STATUS_LABELS } from "@/lib/schemas/enums";
import { cn } from "@/lib/utils";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  FormError,
} from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";

type SourceOption = {
  id: string;
  title: string;
  sourceType: SourceType;
  validationStatus: ValidationStatus;
  extracted: boolean;
};

/**
 * Extraction is the one place where an analyst spends real money and waits real
 * seconds, so the control surface is explicit: choose exactly which sources to
 * read, see which have been read before, and confirm the mode being used.
 */
export function ExtractionRunner({
  projectId,
  defaultMode,
  aiConfigured,
  canExtract,
  sources,
}: {
  projectId: string;
  defaultMode: AnalysisMode;
  aiConfigured: boolean;
  /** False while sources are still awaiting validation — see the gate. */
  canExtract: boolean;
  sources: SourceOption[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    runExtractionAction.bind(null, projectId),
    null,
  );

  // Only validated material can be selected at all; an unvalidated source is
  // shown so its absence is explained, but it cannot be picked.
  const selectable = sources.filter((s) => s.validationStatus === "validated");
  const notYetExtracted = selectable.filter((s) => !s.extracted).map((s) => s.id);
  const [selected, setSelected] = useState<string[]>(
    notYetExtracted.length > 0 ? notYetExtracted : selectable.map((s) => s.id),
  );

  // Re-reading a source that already produced insights replaces the ones still
  // awaiting review, so the confirmation says so before it happens.
  const replacing = selected.filter(
    (id) => sources.find((s) => s.id === id)?.extracted,
  ).length;
  const [confirmed, setConfirmed] = useState(false);
  const needsConfirmation = replacing > 0 && !confirmed;

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Run extraction</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(selectable.map((s) => s.id))}
          >
            Select all
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
            Clear
          </Button>
        </div>
      </CardHeader>
      <CardBody>
        {!aiConfigured ? (
          <div className="mb-4 rounded-md border border-warning-line bg-warning-soft px-3 py-2 text-sm text-warning">
            <p className="font-medium">AI is not configured</p>
            <p className="mt-0.5">
              Set <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> in{" "}
              <code className="font-mono text-xs">.env</code> and restart the dev server.
              Everything else in the app works without it — you can build the requirement
              model by hand.
            </p>
          </div>
        ) : null}

        <form action={formAction} className="space-y-4">
          {state && !state.ok ? <FormError message={state.message} /> : null}
          {state?.ok && state.message ? (
            <p className="rounded-md border border-positive-line bg-positive-soft px-3 py-2 text-sm text-positive">
              {state.message}
            </p>
          ) : null}

          <input type="hidden" name="mode" value={defaultMode} />

          <fieldset>
            <legend className="sr-only">Sources to extract from</legend>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {sources.map((source) => {
                const checked = selected.includes(source.id);
                const blocked = source.validationStatus !== "validated";
                return (
                  <li key={source.id}>
                    <label
                      className={cn(
                        "flex items-start gap-2 rounded-md border px-2.5 py-2 text-sm transition-colors",
                        blocked
                          ? "cursor-not-allowed border-line opacity-60"
                          : checked
                            ? "cursor-pointer border-accent-line bg-accent-soft"
                            : "cursor-pointer border-line hover:bg-surface-muted",
                      )}
                    >
                      <input
                        type="checkbox"
                        name="sourceIds"
                        value={source.id}
                        checked={checked}
                        disabled={blocked}
                        onChange={() => toggle(source.id)}
                        className="mt-0.5 accent-accent disabled:opacity-40"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-ink">{source.title}</span>
                        <span className="text-[11px] text-ink-faint">
                          {SOURCE_TYPE_LABELS[source.sourceType]}
                          {blocked
                            ? ` · ${VALIDATION_STATUS_LABELS[source.validationStatus].toLowerCase()}`
                            : ""}
                          {source.extracted ? " · already extracted" : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            {needsConfirmation ? (
              <>
                <Button variant="danger" onClick={() => setConfirmed(true)}>
                  Re-extract {replacing} source{replacing === 1 ? "" : "s"}…
                </Button>
                <p className="text-xs text-warning">
                  This replaces every insight from{" "}
                  {replacing === 1 ? "that source" : "those sources"} that is still
                  awaiting review. Anything you have accepted, edited or promoted stays.
                </p>
              </>
            ) : (
              <>
                <SubmitButton
                  pendingLabel="Reading sources…"
                  disabled={selected.length === 0 || !aiConfigured || !canExtract}
                  title={
                    !canExtract
                      ? "Every source has to be validated before extraction can run."
                      : undefined
                  }
                >
                  Extract from {selected.length} source{selected.length === 1 ? "" : "s"}
                </SubmitButton>
                <p className="text-xs text-ink-faint">
                  Runs in {defaultMode} framing. Re-running replaces items still awaiting
                  review and leaves anything you have already accepted or edited alone.
                </p>
              </>
            )}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
