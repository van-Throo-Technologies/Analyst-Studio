"use client";

import { useActionState, useState } from "react";
import { updateSourceAction, uploadSourceAction } from "@/app/projects/[id]/sources/actions";
import { parseFileAction } from "@/app/projects/[id]/sources/parse-file";
import type { FormState } from "@/lib/forms";
import type { SourceDocument } from "@/lib/schemas/entities";
import {
  SOURCE_PROVENANCE_HINTS,
  SOURCE_PROVENANCE_LABELS,
  SOURCE_TYPE_LABELS,
  sourceProvenanceSchema,
  sourceTypeSchema,
  type SourceProvenance,
  type SourceType,
} from "@/lib/schemas/enums";
import { wordCount } from "@/lib/utils";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  FormError,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";

/** Formats the browser can read as text directly. */
const CLIENT_READABLE = [".txt", ".md", ".markdown", ".csv", ".json", ".log", ".vtt", ".srt"];
/** Formats that have to be converted on the server. */
const SERVER_PARSED = [".pdf", ".docx", ".doc"];

/**
 * Loading a file is itself a statement about provenance, so the field follows
 * the file rather than making the analyst remember. Only for formats where the
 * conversion is the interesting fact — a pasted .txt says nothing about where
 * the text came from, so it leaves the choice alone.
 */
const PROVENANCE_BY_EXTENSION: Record<string, SourceProvenance> = {
  ".pdf": "pdf_upload",
  ".docx": "docx_upload",
  ".doc": "docx_upload",
};

const ACCEPTED_FILES = [...CLIENT_READABLE, ...SERVER_PARSED].join(",");

/** Pasted text is small; PDFs are not, so the two have different ceilings. */
const MAX_CLIENT_BYTES = 2 * 1024 * 1024;
const MAX_SERVER_BYTES = 10 * 1024 * 1024;

/** `Date` → the `yyyy-mm-dd` an <input type="date"> expects, in UTC. */
function toDateInput(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

/**
 * Intake is the one place an analyst pastes a wall of text, so the affordances
 * matter: a large paste target, a file loader, and a title guess so nobody has
 * to think about naming.
 *
 * Files land in the same `content` field as a paste, whichever route they take:
 * text formats are read in the browser, PDF and DOCX go to a server action that
 * returns plain text. Nothing is stored as a file either way — a source is
 * text, always, and the analyst sees the extracted text before saving it.
 */
export function SourceComposer({
  projectId,
  source,
}: {
  projectId: string;
  /** Omit to create; provide to edit an existing source. */
  source?: SourceDocument;
}) {
  const editing = source !== undefined;

  const [state, formAction] = useActionState<FormState, FormData>(
    editing
      ? updateSourceAction.bind(null, projectId, source.id)
      : uploadSourceAction.bind(null, projectId),
    null,
  );

  const [content, setContent] = useState(source?.content ?? "");
  const [title, setTitle] = useState(source?.title ?? "");
  const [sourceType, setSourceType] = useState<SourceType>(
    source?.sourceType ?? "workshop_notes",
  );
  const [provenance, setProvenance] = useState<SourceProvenance>(
    source?.sourceProvenance ?? "manual_transcription",
  );
  const [originDate, setOriginDate] = useState(toDateInput(source?.sourceTimestamp));
  const [fileError, setFileError] = useState<string | null>(null);
  const [parsing, setParsing] = useState<string | null>(null);

  // Note: after a successful create the sources page remounts this component
  // (it is keyed by the source count), which clears the form for the next
  // paste. Doing it that way rather than resetting state from an effect keeps
  // the component free of cascading renders.

  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const words = wordCount(content);

  /** Reads one file by whichever route its format requires. */
  async function readFile(file: File): Promise<string> {
    const ext = extensionOf(file.name);

    if (SERVER_PARSED.includes(ext)) {
      if (file.size > MAX_SERVER_BYTES) {
        throw new Error(
          `${file.name} is larger than 10 MB. Split it, or paste the relevant part.`,
        );
      }
      const formData = new FormData();
      formData.append("file", file);
      const result = await parseFileAction(formData);
      if (!result.ok) throw new Error(result.message);
      return result.text;
    }

    if (file.size > MAX_CLIENT_BYTES) {
      throw new Error(
        `${file.name} is larger than 2 MB — paste the relevant part instead.`,
      );
    }
    return file.text();
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setFileError(null);

    const list = Array.from(files);
    const parts: string[] = [];
    const failures: string[] = [];

    for (const file of list) {
      setParsing(file.name);
      try {
        const text = await readFile(file);
        parts.push(list.length > 1 ? `--- ${file.name} ---\n${text}` : text);
      } catch (error) {
        // One bad file in a multi-file selection must not discard the good ones.
        failures.push(
          error instanceof Error ? error.message : `Could not read ${file.name}.`,
        );
      }
    }
    setParsing(null);

    if (failures.length > 0) setFileError(failures.join(" "));
    if (parts.length === 0) return;

    const joined = parts.join("\n\n");
    setContent((prev) => (prev.trim().length > 0 ? `${prev.trim()}\n\n${joined}` : joined));

    if (title.trim().length === 0) {
      // Filename minus extension is nearly always the right title.
      setTitle(list[0].name.replace(/\.[^.]+$/, ""));
    }

    const fromFile = PROVENANCE_BY_EXTENSION[extensionOf(list[0].name)];
    if (fromFile) setProvenance(fromFile);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editing ? "Edit source" : "Add a source"}</CardTitle>
        {state?.ok && state.message ? (
          <span className="text-xs text-positive">{state.message}</span>
        ) : null}
      </CardHeader>
      <CardBody>
        <form action={formAction} className="space-y-4">
          {state && !state.ok ? <FormError message={state.message} /> : null}

          <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
            <Field label="Title" htmlFor="title" required error={errors.title}>
              <Input
                id="title"
                name="title"
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Discovery workshop — 12 March"
              />
            </Field>

            <Field label="Source type" htmlFor="sourceType" error={errors.sourceType}>
              <Select
                id="sourceType"
                name="sourceType"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as SourceType)}
              >
                {sourceTypeSchema.options.map((value) => (
                  <option key={value} value={value}>
                    {SOURCE_TYPE_LABELS[value]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
            <Field
              label="Where it came from"
              htmlFor="sourceProvenance"
              error={errors.sourceProvenance}
              hint={SOURCE_PROVENANCE_HINTS[provenance]}
            >
              <Select
                id="sourceProvenance"
                name="sourceProvenance"
                value={provenance}
                onChange={(e) => setProvenance(e.target.value as SourceProvenance)}
              >
                {sourceProvenanceSchema.options.map((value) => (
                  <option key={value} value={value}>
                    {SOURCE_PROVENANCE_LABELS[value]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Origin date"
              htmlFor="sourceTimestamp"
              error={errors.sourceTimestamp}
              hint="When it was written, not when you added it. Leave empty if unknown."
            >
              <Input
                id="sourceTimestamp"
                name="sourceTimestamp"
                type="date"
                value={originDate}
                onChange={(e) => setOriginDate(e.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Content"
            htmlFor="content"
            required
            error={errors.content ?? fileError ?? undefined}
            hint="Paste the raw material as-is. Do not tidy it up — contradictions and half-finished thoughts are signal, and the quality checks look for them. PDF and DOCX files are converted to text server-side; nothing is stored as a file."
          >
            <Textarea
              id="content"
              name="content"
              required
              rows={editing ? 24 : 12}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="font-mono text-[13px]"
              placeholder="Paste workshop notes, a call transcript, an email thread, a feature brief…"
            />
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <SubmitButton pendingLabel={editing ? "Saving…" : "Adding…"}>
                {editing ? "Save source" : "Add source"}
              </SubmitButton>

              <label className="cursor-pointer text-xs text-ink-muted underline underline-offset-2 hover:text-ink">
                {parsing ? `Converting ${parsing}…` : "or load a file"}
                <input
                  type="file"
                  accept={ACCEPTED_FILES}
                  multiple
                  disabled={parsing !== null}
                  className="sr-only"
                  onChange={(e) => {
                    void handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            <span className="text-xs tabular-nums text-ink-faint">
              {words.toLocaleString()} words · {content.length.toLocaleString()} characters
            </span>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
