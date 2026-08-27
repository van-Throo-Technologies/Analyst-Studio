"use client";

import { useActionState, useRef, useState } from "react";
import { uploadDocument, deleteDocument, type ActionState } from "../lib/actions";
import styles from "./DocumentUploadArea.module.css";

const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

type SourceDocument = {
  id: string;
  filename: string;
  mimeType: string;
  uploadedAt: Date;
};

export function DocumentUploadArea({
  projectId,
  documents,
}: {
  projectId: string;
  documents: SourceDocument[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    uploadDocument,
    {},
  );
  const [removeState, removeAction] = useActionState<ActionState, FormData>(
    deleteDocument,
    {},
  );

  const formRef = useRef<HTMLFormElement>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const error = state.error ?? removeState.error;

  return (
    <section className={styles.card}>
      <header className={styles.head}>
        <h2 className={styles.title}>Source material</h2>
        <p className={styles.hint}>
          Plain-text transcripts and notes — .txt, .md, .vtt, .srt, .csv.
        </p>
      </header>

      {documents.length > 0 && (
        <ul className={styles.list}>
          {documents.map((doc) => (
            <li key={doc.id} className={styles.item}>
              <span className={styles.docIcon} aria-hidden="true">
                <svg viewBox="0 0 20 20" width="16" height="16" fill="none"
                  stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
                  strokeLinejoin="round">
                  <path d="M11.5 2.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 17.5h8a1.5 1.5 0 0 0 1.5-1.5V6.5z" />
                  <path d="M11.5 2.5v4h4" />
                </svg>
              </span>
              <span className={styles.docName}>{doc.filename}</span>
              <span className={styles.docDate}>{DATE.format(doc.uploadedAt)}</span>
              <form action={removeAction}>
                <input type="hidden" name="documentId" value={doc.id} />
                <input type="hidden" name="projectId" value={projectId} />
                <button type="submit" className={styles.remove}>
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          formRef.current?.reset();
          setFilename(null);
        }}
        className={styles.form}
      >
        <input type="hidden" name="projectId" value={projectId} />

        <label className={styles.drop}>
          <input
            type="file"
            name="file"
            accept=".txt,.md,.vtt,.srt,.csv,.log,text/plain"
            className={styles.fileInput}
            onChange={(event) =>
              setFilename(event.target.files?.[0]?.name ?? null)
            }
          />
          <span className={styles.dropIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
              strokeLinejoin="round">
              <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
              <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
            </svg>
          </span>
          <span className={styles.dropText}>
            {filename ?? "Choose a transcript file"}
          </span>
        </label>

        <div className={styles.or}>or paste it</div>

        <textarea
          name="pasted"
          rows={5}
          className={styles.textarea}
          placeholder="Paste meeting notes or a transcript…"
        />

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? "Adding…" : "Add to project"}
        </button>
      </form>
    </section>
  );
}
