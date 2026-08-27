import type { Pack, PackSection } from "../../lib/pack-generator";
import styles from "./packs.module.css";

// BA and FA sections share a shape, so they share a renderer. The packs differ
// in what they select and how they frame it — not in how a heading looks.

function isEmpty(section: PackSection) {
  return (
    (section.body?.length ?? 0) === 0 &&
    (section.bullets?.length ?? 0) === 0 &&
    (section.entries?.length ?? 0) === 0
  );
}

export function PackSections({ pack }: { pack: Pack }) {
  return (
    <div className={styles.sections}>
      {pack.sections.map((section) => (
        <section key={section.heading} className={styles.section}>
          <h3 className={styles.heading}>{section.heading}</h3>

          {isEmpty(section) ? (
            // An absent section reads as a bug; a stated gap reads as a finding.
            <p className={styles.empty}>{section.emptyNote}</p>
          ) : (
            <>
              {section.body?.map((paragraph, i) => (
                <p key={i} className={styles.paragraph}>
                  {paragraph}
                </p>
              ))}

              {(section.bullets?.length ?? 0) > 0 && (
                <ul className={styles.bullets}>
                  {section.bullets?.map((bullet, i) => (
                    <li key={i}>{bullet}</li>
                  ))}
                </ul>
              )}

              {section.entries?.map((item) => (
                <article key={item.id} className={styles.entry}>
                  <div className={styles.entryBadges}>
                    <span className={styles.type}>{item.type}</span>
                    <span className={styles.priority}>{item.priority}</span>
                    {item.scope === "out-of-scope" && (
                      <span className={styles.outOfScope}>Out of scope</span>
                    )}
                    <span className={styles.score}>{item.completionScore}% specified</span>
                  </div>

                  <h4 className={styles.entryTitle}>{item.title}</h4>
                  <p className={styles.entryBody}>{item.description}</p>

                  {item.details.map((detail) => (
                    <div key={detail.label} className={styles.detail}>
                      <h5 className={styles.detailLabel}>{detail.label}</h5>
                      <ul className={styles.bullets}>
                        {detail.items.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </article>
              ))}
            </>
          )}
        </section>
      ))}
    </div>
  );
}

export function PackHeader({ pack }: { pack: Pack }) {
  return (
    <header className={styles.packHead}>
      <h2 className={styles.packTitle}>{pack.title}</h2>
      <p className={styles.packSummary}>{pack.summary}</p>
      <p className={styles.packMeta}>
        For {pack.generatedFor} · {pack.requirementCount} requirement
        {pack.requirementCount === 1 ? "" : "s"}
      </p>
    </header>
  );
}
