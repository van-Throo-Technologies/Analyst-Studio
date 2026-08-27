import styles from "./trace.module.css";

const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export type TraceDocument = {
  id: string;
  filename: string;
  uploadedAt: Date | string;
  requirementCount: number;
  share: number;
};

/** One source document, and how much of the requirement set came out of it. */
export function DocumentTrace({
  document,
  selected,
  dimmed,
  onSelect,
}: {
  document: TraceDocument;
  selected: boolean;
  dimmed: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        styles.node,
        selected ? styles.nodeOn : "",
        dimmed ? styles.nodeDim : "",
      ].join(" ")}
    >
      <span className={styles.nodeTitle}>{document.filename}</span>
      <span className={styles.nodeMeta}>
        {DATE.format(new Date(document.uploadedAt))}
      </span>

      <span className={styles.bar} aria-hidden="true">
        <span className={styles.barFill} style={{ width: `${document.share}%` }} />
      </span>
      <span className={styles.nodeMeta}>
        {document.requirementCount} requirement
        {document.requirementCount === 1 ? "" : "s"} · {document.share}% of the set
      </span>
    </button>
  );
}
