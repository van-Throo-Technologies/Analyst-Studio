"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./export.module.css";

const FORMATS = [
  { id: "pdf", label: "PDF", note: "Formatted document for sharing or print" },
  { id: "markdown", label: "Markdown", note: "For a repo, a wiki, or further editing" },
  { id: "jira", label: "Jira", note: "Jira wiki markup, ready to paste" },
  { id: "confluence", label: "Confluence", note: "Storage format, paste into source view" },
] as const;

type FormatId = (typeof FORMATS)[number]["id"];

// Jira and Confluence exist to be pasted somewhere, so those two offer a copy
// as well as a download. PDF cannot be copied as text and Markdown is usually
// wanted as a file.
const COPYABLE: FormatId[] = ["jira", "confluence"];

export function ExportMenu({
  projectId,
  packType,
}: {
  projectId: string;
  packType: "ba" | "fa";
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<FormatId | null>(null);
  const [copied, setCopied] = useState<FormatId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape — the usual expectations of a menu.
  useEffect(() => {
    if (!open) return;

    const onPointer = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function url(format: FormatId) {
    return `/api/projects/${projectId}/export/${format}?packType=${packType}`;
  }

  async function download(format: FormatId) {
    setBusy(format);
    setError(null);
    try {
      const response = await fetch(url(format));
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "That export could not be generated.");
      }

      // Fetched rather than linked so a failure surfaces as a message instead of
      // navigating the user to a JSON error page.
      const blob = await response.blob();
      const filename =
        response.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ?? `${packType}-pack`;

      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  async function copy(format: FormatId) {
    setBusy(format);
    setError(null);
    try {
      const response = await fetch(url(format));
      if (!response.ok) throw new Error("That export could not be generated.");
      await navigator.clipboard.writeText(await response.text());
      setCopied(format);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Could not copy — your browser may be blocking clipboard access.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        Export
        <span aria-hidden="true" className={styles.caret}>
          ▾
        </span>
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          <p className={styles.menuHead}>
            Exporting the {packType === "ba" ? "BA" : "FA"} pack
          </p>

          {FORMATS.map((format) => (
            <div key={format.id} className={styles.row}>
              <button
                type="button"
                role="menuitem"
                className={styles.item}
                disabled={busy !== null}
                onClick={() => download(format.id)}
              >
                <span className={styles.itemLabel}>
                  {busy === format.id ? "Preparing…" : format.label}
                </span>
                <span className={styles.itemNote}>{format.note}</span>
              </button>

              {COPYABLE.includes(format.id) && (
                <button
                  type="button"
                  className={styles.copy}
                  disabled={busy !== null}
                  onClick={() => copy(format.id)}
                >
                  {copied === format.id ? "Copied" : "Copy"}
                </button>
              )}
            </div>
          ))}

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
