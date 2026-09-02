import type { RuleRecord } from "../../lib/rules";
import { RECORD_TYPE_LABELS, INDUSTRY_LABELS } from "../../lib/constants";
import styles from "./rules.module.css";

function kindClass(recordType: string) {
  if (recordType === "business-rule") return styles.kindRule;
  if (recordType === "regulatory-constraint") return styles.kindRegulatory;
  if (recordType === "use-case") return styles.kindUseCase;
  if (recordType === "acceptance-criteria") return styles.kindCriterion;
  return styles.kindFeature;
}

export function RuleCard({ rule }: { rule: RuleRecord }) {
  return (
    <li className={styles.card}>
      <div className={styles.badges}>
        <span className={`${styles.kind} ${kindClass(rule.recordType)}`}>
          {RECORD_TYPE_LABELS[rule.recordType] ?? rule.recordType}
        </span>
        <span className={styles.industry}>
          {INDUSTRY_LABELS[rule.industry] ?? rule.industry}
        </span>
        {rule.isGrounded ? (
          <span className={styles.grounded} title="Its quote was found in the source by literal match">
            Evidence-backed
          </span>
        ) : (
          <span className={styles.inferred} title="No quote could be verified — treat as an inference">
            Inferred
          </span>
        )}
      </div>

      <h3 className={styles.title}>{rule.title}</h3>
      <p className={styles.description}>{rule.description}</p>

      {/* The quote is the point. A rule the reader cannot trace back to a
          sentence someone actually wrote is just an assertion. */}
      {rule.quote && (
        <blockquote className={styles.quote}>
          {rule.quote}
          <cite className={styles.source}>{rule.sourceDocument}</cite>
        </blockquote>
      )}

      {(rule.tags.length > 0 || rule.regulatoryFrameworks.length > 0) && (
        <div className={styles.chips}>
          {rule.regulatoryFrameworks.map((f) => (
            <span key={f} className={styles.framework}>
              {f}
            </span>
          ))}
          {rule.tags.map((t) => (
            <span key={t} className={styles.tag}>
              {t}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}
