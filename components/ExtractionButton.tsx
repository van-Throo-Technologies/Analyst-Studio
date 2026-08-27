"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ExtractionButton.module.css";

type Phase = "idle" | "running" | "error";

export function ExtractionButton({
  projectId,
  documentCount,
  hasRequirements,
  editedCount,
}: {
  projectId: string;
  documentCount: number;
  hasRequirements: boolean;
  editedCount: number;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [found, setFound] = useState(0);
  const [stage, setStage] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // A visible clock is the honest signal during the stretch before the first
  // requirement lands — the model reads everything before it writes anything.
  useEffect(() => {
    if (phase !== "running") return;
    const started = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // Abort the request if the component goes away mid-run, so the browser is not
  // left holding a stream nobody reads.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function run() {
    setPhase("running");
    setFound(0);
    setStage(null);
    setSummary(null);
    setElapsed(0);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`/api/projects/${projectId}/extract`, {
        method: "POST",
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Extraction could not be started.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let failed: string | null = null;
      let finished = false;

      // Events are newline-delimited but arrive in arbitrary chunks, so the tail
      // of the buffer is held back until its terminator shows up.
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;

          const event = JSON.parse(line.slice(5).trim());
          if (event.type === "progress") setFound(event.found);
          else if (event.type === "stage") {
            setStage(event.label);
            // Each stage restarts the count it reports, so the requirement
            // tally only belongs to the extraction stage that produced it.
            if (event.stage !== "extract") setFound(0);
          } else if (event.type === "done") {
            finished = true;
            setSummary(
              `${event.count} requirement${event.count === 1 ? "" : "s"} · ` +
                `${event.grounded}/${event.count} evidence-backed · ` +
                `${event.coverageScore}% coverage` +
                (event.gaps > 0 ? ` · ${event.gaps} gap${event.gaps === 1 ? "" : "s"} to ask about` : ""),
            );
          } else if (event.type === "error") failed = event.message;
        }
      }

      if (failed) {
        setPhase("error");
        setError(failed);
        return;
      }

      if (!finished) {
        setPhase("error");
        setError("The connection dropped before extraction finished. Try again.");
        return;
      }

      setPhase("idle");
      setStage(null);
      router.refresh();
    } catch (caught) {
      if (controller.signal.aborted) return;
      setPhase("error");
      setError(caught instanceof Error ? caught.message : "Extraction failed.");
    }
  }

  const running = phase === "running";
  const disabled = running || documentCount === 0;

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        onClick={run}
        className={styles.button}
        disabled={disabled}
        aria-busy={running}
      >
        {running && <span className={styles.spinner} aria-hidden="true" />}
        {running
          ? "Analysing…"
          : hasRequirements
            ? "Re-run extraction"
            : "Extract requirements"}
      </button>

      {running ? (
        <p className={styles.status} role="status">
          {found > 0
            ? `${found} requirement${found === 1 ? "" : "s"} written…`
            : (stage ?? `Reading ${documentCount} document${documentCount === 1 ? "" : "s"}`) + "…"}
          <span className={styles.clock}>{elapsed}s</span>
        </p>
      ) : summary ? (
        <p className={styles.summary}>{summary}</p>
      ) : (
        <p className={styles.note}>
          {documentCount === 0
            ? "Add source material first."
            : editedCount > 0
              ? `Re-running rewrites the generated requirements. Your ${editedCount} edited one${editedCount === 1 ? " stays" : "s stay"}.`
              : hasRequirements
                ? "Re-running replaces the requirements below."
                : "Reads every document in this project."}
        </p>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
