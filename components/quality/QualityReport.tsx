import { ISSUE_LABELS, type QualityReport as Report, type Severity } from "../../lib/quality-checker";
import styles from "./quality.module.css";

const SEVERITY_CLASS: Record<Severity, string> = {
  high: styles.high,
  medium: styles.medium,
  low: styles.low,
};

const SEVERITY_LABEL: Record<Severity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function scoreClass(score: number) {
  if (score >= 80) return styles.scoreGood;
  if (score >= 50) return styles.scoreFair;
  return styles.scoreThin;
}

export function QualityReport({ report }: { report: Report }) {
  if (report.checked === 0) {
    return (
      <p className={styles.empty}>
        Nothing to check yet — run extraction first.
      </p>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.summary}>
        <div className={`${styles.scoreBox} ${scoreClass(report.score)}`}>
          <span className={styles.scoreValue}>{report.score}%</span>
          <span className={styles.scoreLabel}>quality score</span>
        </div>

        <div className={styles.counts}>
          {(["high", "medium", "low"] as const).map((severity) => (
            <span key={severity} className={`${styles.count} ${SEVERITY_CLASS[severity]}`}>
              {report.counts[severity]} {SEVERITY_LABEL[severity].toLowerCase()}
            </span>
          ))}
          <span className={styles.checked}>
            across {report.checked} requirement{report.checked === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {report.issues.length === 0 ? (
        <p className={styles.clean}>
          No issues found. Worth knowing what that does and does not mean: these
          checks catch vague wording, missing criteria, near-duplicates and
          lopsided priorities. They cannot tell you whether the requirements are
          the right ones.
        </p>
      ) : (
        <ul className={styles.list}>
          {report.issues.map((issue, i) => (
            <li key={`${issue.requirementId}-${issue.type}-${i}`} className={styles.issue}>
              <div className={styles.issueHead}>
                <span className={`${styles.severity} ${SEVERITY_CLASS[issue.severity]}`}>
                  {SEVERITY_LABEL[issue.severity]}
                </span>
                <span className={styles.issueType}>{ISSUE_LABELS[issue.type]}</span>
              </div>

              <p className={styles.issueTitle}>{issue.requirementTitle}</p>
              <p className={styles.issueMessage}>{issue.message}</p>
              <p className={styles.issueSuggestion}>{issue.suggestion}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
