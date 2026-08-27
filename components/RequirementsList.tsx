import type { RequirementRecord } from "../lib/projects";
import { RequirementEditor } from "./RequirementEditor";
import styles from "./RequirementsList.module.css";

// Multi-value fields are stored newline-joined, so they come back apart the
// same way. Blank lines are dropped rather than rendered as empty bullets.
function lines(value: string | null) {
  if (!value) return [];
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
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

export function RequirementsList({
  requirements,
  projectId,
}: {
  requirements: RequirementRecord[];
  projectId: string;
}) {
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
      <h2 className={styles.heading}>
        {requirements.length} requirement{requirements.length === 1 ? "" : "s"}
      </h2>
      <ul className={styles.list}>
        {requirements.map((requirement) => (
          <RequirementCard
            key={requirement.id}
            requirement={requirement}
            projectId={projectId}
          />
        ))}
      </ul>
    </section>
  );
}
