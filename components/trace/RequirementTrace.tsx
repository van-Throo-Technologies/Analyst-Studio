import styles from "./trace.module.css";

export type TraceRequirement = {
  id: string;
  title: string;
  type: string;
  priority: string;
  sourceDocumentIds: string[];
  sourceFilenames: string[];
  criteria: string[];
};

/** One requirement, with the documents behind it named on its face. */
export function RequirementTrace({
  requirement,
  selected,
  dimmed,
  onSelect,
}: {
  requirement: TraceRequirement;
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
      <span className={styles.nodeTitle}>{requirement.title}</span>
      <span className={styles.nodeMeta}>
        {requirement.type} · {requirement.priority}
      </span>

      {/* Naming the source on the card is what makes this readable without
          drawing lines between columns — the link travels with the item. */}
      <span className={styles.chips}>
        {requirement.sourceFilenames.length === 0 ? (
          <span className={styles.chipMuted}>No source recorded</span>
        ) : (
          requirement.sourceFilenames.map((filename) => (
            <span key={filename} className={styles.chip}>
              {filename}
            </span>
          ))
        )}
      </span>
    </button>
  );
}
