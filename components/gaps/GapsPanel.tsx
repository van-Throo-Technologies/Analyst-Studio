import styles from "./gaps.module.css";

export type Finding = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  evidence: string | null;
  severity: string;
};

const SEVERITY_CLASS: Record<string, string> = {
  high: styles.high,
  medium: styles.medium,
  low: styles.low,
};

function Group({
  title,
  intro,
  findings,
  emptyNote,
}: {
  title: string;
  intro: string;
  findings: Finding[];
  emptyNote: string;
}) {
  return (
    <section className={styles.group}>
      <h3 className={styles.groupTitle}>
        {title}
        {findings.length > 0 && <span className={styles.count}>{findings.length}</span>}
      </h3>
      <p className={styles.intro}>{intro}</p>

      {findings.length === 0 ? (
        <p className={styles.empty}>{emptyNote}</p>
      ) : (
        <ul className={styles.list}>
          {findings.map((finding) => (
            <li key={finding.id} className={styles.item}>
              <div className={styles.itemHead}>
                <span className={`${styles.severity} ${SEVERITY_CLASS[finding.severity] ?? styles.low}`}>
                  {finding.severity}
                </span>
                <h4 className={styles.itemTitle}>{finding.title}</h4>
              </div>

              <p className={styles.detail}>{finding.detail}</p>

              {/* Coverage gaps carry the source line that was missed. Domain
                  gaps have no quote by definition — they are things nobody
                  said, which is exactly why they are worth raising. */}
              {finding.evidence && (
                <blockquote className={styles.quote}>{finding.evidence}</blockquote>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function GapsPanel({
  findings,
  coverageScore,
  hasRequirements,
}: {
  findings: Finding[];
  coverageScore: number | null;
  hasRequirements: boolean;
}) {
  if (!hasRequirements) {
    return (
      <p className={styles.empty}>
        Run extraction first — gaps are found by re-reading the source against
        the requirements that came out of it.
      </p>
    );
  }

  const coverage = findings.filter((f) => f.kind === "coverage-gap");
  const domain = findings.filter((f) => f.kind === "domain-gap");

  return (
    <div className={styles.wrap}>
      {coverageScore !== null && (
        <div className={styles.scoreRow}>
          <div className={styles.scoreBox}>
            <span className={styles.scoreValue}>{coverageScore}%</span>
            <span className={styles.scoreLabel}>source coverage</span>
          </div>
          <p className={styles.scoreNote}>
            The share of requirement-bearing content in your documents that a
            requirement now represents. Anything below it is listed here, with
            the line it came from.
          </p>
        </div>
      )}

      <Group
        title="Missed in the source"
        intro="Requirement-bearing content that appears in your documents but is not represented by any requirement. Each is quoted from the source, and every quote was checked against it."
        findings={coverage}
        emptyNote="Nothing in the source went unrepresented."
      />

      <Group
        title="Never discussed"
        intro="Things a system of this kind normally needs that nobody in the material raised at all. These are questions to put to people — not requirements, and deliberately not written as any."
        findings={domain}
        emptyNote="No standard concerns look unaddressed."
      />
    </div>
  );
}
