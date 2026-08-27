import type { RequirementRecord } from "../lib/projects";
import { RequirementEditor } from "./RequirementEditor";
import { RECORD_TYPE_LABELS } from "../lib/constants";
import styles from "./RequirementsList.module.css";

// Multi-value fields are stored newline-joined, so they come back apart the
// same way. Blank lines are dropped rather than rendered as empty bullets.
// Evidence is stored as a JSON array of quotes that already passed the literal
// source match. A malformed value is treated as no evidence rather than thrown —
// an unreadable field should not take the page down.
function quotes(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((q): q is string => typeof q === "string") : [];
  } catch {
    return [];
  }
}

function lines(value: string | null) {
  if (!value) return [];
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function recordTypeClass(recordType: string) {
  if (recordType === "business-rule") return styles.kindRule;
  if (recordType === "regulatory-constraint") return styles.kindRegulatory;
  if (recordType === "use-case") return styles.kindUseCase;
  if (recordType === "acceptance-criteria") return styles.kindCriterion;
  return styles.kindFeature;
}

function priorityClass(priority: string) {
  const key = priority.toLowerCase();
  if (key === "high") return styles.priHigh;
  if (key === "medium") return styles.priMedium;
  return styles.priLow;
}

function scoreClass(score: number) {
  if (score >= 70) return styles.scoreGood;
  if (score >= 40) return styles.scoreFair;
  return styles.scoreThin;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.detail}>
      <h4 className={styles.detailLabel}>{label}</h4>
      {children}
    </div>
  );
}

function Bullets({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Detail label={label}>
      <ul className={styles.bullets}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </Detail>
  );
}

function RequirementCard({
  requirement,
  projectId,
}: {
  requirement: RequirementRecord;
  projectId: string;
}) {
  const evidence = quotes(requirement.evidence);
  const alternates = lines(requirement.alternateFlows);
  const bdd = lines(requirement.bdDAC);
  const checklist = lines(requirement.checklistAC);
  const gates = lines(requirement.validationGates);

  const hasDetail =
    requirement.actor ||
    requirement.trigger ||
    requirement.happyPath ||
    alternates.length > 0 ||
    bdd.length > 0 ||
    checklist.length > 0;

  return (
    <li className={styles.card}>
      <div className={styles.badges}>
        <span className={`${styles.kind} ${recordTypeClass(requirement.recordType)}`}>
          {RECORD_TYPE_LABELS[requirement.recordType] ?? requirement.recordType}
        </span>
        {requirement.isGrounded ? (
          <span className={styles.grounded} title="Every supporting quote was found in the source">
            Evidence-backed
          </span>
        ) : (
          <span
            className={styles.inferred}
            title="No quote from the source could be verified for this requirement — treat it as an inference"
          >
            Inferred
          </span>
        )}
        <span className={styles.type}>{requirement.type}</span>
        <span className={`${styles.priority} ${priorityClass(requirement.priority)}`}>
          {requirement.priority}
        </span>
        {requirement.isEdited && (
          <span className={styles.edited} title="Edited by hand — extraction leaves it alone">
            Edited
          </span>
        )}
        <span className={styles.spacer} />
        <span
          className={`${styles.score} ${scoreClass(requirement.completionScore)}`}
          title="How completely the source material specifies this requirement"
        >
          {requirement.completionScore}% specified
        </span>
      </div>

      <h3 className={styles.title}>{requirement.title}</h3>
      <p className={styles.description}>{requirement.description}</p>

      {gates.length > 0 && (
        <div className={styles.gates}>
          <h4 className={styles.gatesLabel}>Open questions</h4>
          <ul className={styles.bullets}>
            {gates.map((gate, i) => (
              <li key={i}>{gate}</li>
            ))}
          </ul>
        </div>
      )}

      {evidence.length > 0 && (
        <div className={styles.evidence}>
          <h4 className={styles.evidenceLabel}>From the source</h4>
          {evidence.map((quote, i) => (
            <blockquote key={i} className={styles.quote}>
              {quote}
            </blockquote>
          ))}
        </div>
      )}

      {/* <details> rather than state, so the card stays a server component. */}
      {hasDetail && (
        <details className={styles.more}>
          <summary className={styles.summary}>Specification</summary>

          <div className={styles.details}>
            {requirement.actor && (
              <Detail label="Actor">
                <p className={styles.detailBody}>{requirement.actor}</p>
              </Detail>
            )}
            {requirement.trigger && (
              <Detail label="Trigger">
                <p className={styles.detailBody}>{requirement.trigger}</p>
              </Detail>
            )}
            {requirement.happyPath && (
              <Detail label="Happy path">
                <p className={styles.detailBody}>{requirement.happyPath}</p>
              </Detail>
            )}
            <Bullets label="Alternate flows" items={alternates} />
            <Bullets label="Acceptance criteria (Given / When / Then)" items={bdd} />
            <Bullets label="Acceptance checklist" items={checklist} />
          </div>
        </details>
      )}

      <RequirementEditor requirement={requirement} projectId={projectId} />
    </li>
  );
}

// Children render beneath the feature they hang off, so a reader sees a feature
// and the rules that govern it together rather than as unrelated rows.
function ChildRow({ record }: { record: RequirementRecord }) {
  const statement = record.businessRule ?? record.description;
  return (
    <li className={styles.child}>
      <span className={`${styles.kind} ${recordTypeClass(record.recordType)}`}>
        {RECORD_TYPE_LABELS[record.recordType] ?? record.recordType}
      </span>
      <div className={styles.childBody}>
        <p className={styles.childTitle}>{record.title}</p>
        {statement !== record.title && (
          <p className={styles.childDetail}>{statement}</p>
        )}
        {record.validation && (
          <span className={styles.framework}>{record.validation}</span>
        )}
      </div>
    </li>
  );
}

export function RequirementsList({
  requirements,
  projectId,
}: {
  requirements: RequirementRecord[];
  projectId: string;
}) {
  const features = requirements.filter((r) => r.recordType === "feature");
  const childrenByParent = new Map<string, RequirementRecord[]>();
  const orphans: RequirementRecord[] = [];

  for (const record of requirements) {
    if (record.recordType === "feature") continue;
    if (!record.parentRequirementId) {
      orphans.push(record);
      continue;
    }
    const list = childrenByParent.get(record.parentRequirementId) ?? [];
    list.push(record);
    childrenByParent.set(record.parentRequirementId, list);
  }

  const counts = requirements.reduce<Record<string, number>>((acc, r) => {
    acc[r.recordType] = (acc[r.recordType] ?? 0) + 1;
    return acc;
  }, {});

  if (requirements.length === 0) {
    return (
      <section className={styles.empty}>
        <h2 className={styles.emptyTitle}>No requirements yet</h2>
        <p className={styles.emptyBody}>
          Add your discovery material above, then run extraction. Every
          requirement comes back with acceptance criteria and the open questions
          still to resolve.
        </p>
      </section>
    );
  }

  return (
    <section>
      <div className={styles.summary}>
        <h2 className={styles.heading}>
          {requirements.length} record{requirements.length === 1 ? "" : "s"}
        </h2>
        <div className={styles.tally}>
          {Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([kind, n]) => (
              <span key={kind} className={`${styles.kind} ${recordTypeClass(kind)}`}>
                {n} {RECORD_TYPE_LABELS[kind] ?? kind}
                {n === 1 ? "" : kind === "acceptance-criteria" ? "" : "s"}
              </span>
            ))}
        </div>
      </div>

      <ul className={styles.list}>
        {features.map((feature) => {
          const children = childrenByParent.get(feature.id) ?? [];
          return (
            <li key={feature.id} className={styles.group}>
              <ul className={styles.list}>
                <RequirementCard requirement={feature} projectId={projectId} />
              </ul>
              {children.length > 0 && (
                <ul className={styles.children}>
                  {children.map((child) => (
                    <ChildRow key={child.id} record={child} />
                  ))}
                </ul>
              )}
            </li>
          );
        })}

        {/* Records whose parent title did not match a feature. Shown rather
            than hidden — a rule nobody can find is worse than a loose one. */}
        {orphans.length > 0 && (
          <li className={styles.group}>
            <h3 className={styles.orphanHeading}>Not linked to a feature</h3>
            <ul className={styles.children}>
              {orphans.map((record) => (
                <ChildRow key={record.id} record={record} />
              ))}
            </ul>
          </li>
        )}
      </ul>
    </section>
  );
}
