"use client";

import { useState } from "react";
import { DocumentTrace, type TraceDocument } from "./DocumentTrace";
import { RequirementTrace, type TraceRequirement } from "./RequirementTrace";
import styles from "./trace.module.css";

// Documents → requirements → acceptance criteria, left to right.
//
// The link between columns is carried by highlighting and by the source names
// printed on each requirement, rather than by drawn connectors: the columns
// scroll independently and their rows are different heights, so literal lines
// would be pointing at the wrong things as soon as anyone scrolled.
export function TraceView({
  documents,
  requirements,
}: {
  documents: TraceDocument[];
  requirements: TraceRequirement[];
}) {
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [requirementId, setRequirementId] = useState<string | null>(null);

  if (documents.length === 0) {
    return (
      <p className={styles.empty}>
        No source documents yet. Trace links appear once material has been added
        and extraction has run.
      </p>
    );
  }

  const selectedRequirement = requirements.find((r) => r.id === requirementId) ?? null;

  // Selecting a requirement implies its documents, so the left column follows
  // the selection in both directions.
  const activeDocumentIds = selectedRequirement
    ? selectedRequirement.sourceDocumentIds
    : documentId
      ? [documentId]
      : [];

  const isFiltering = activeDocumentIds.length > 0 || selectedRequirement !== null;

  const visibleCriteria = selectedRequirement
    ? [{ requirement: selectedRequirement, criteria: selectedRequirement.criteria }]
    : requirements
        .filter(
          (r) =>
            activeDocumentIds.length === 0 ||
            r.sourceDocumentIds.some((id) => activeDocumentIds.includes(id)),
        )
        .map((r) => ({ requirement: r, criteria: r.criteria }));

  function clear() {
    setDocumentId(null);
    setRequirementId(null);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <p className={styles.hint}>
          {isFiltering
            ? "Showing one thread through the set."
            : "Select a document or a requirement to follow one thread."}
        </p>
        {isFiltering && (
          <button type="button" className={styles.clear} onClick={clear}>
            Show everything
          </button>
        )}
      </div>

      <div className={styles.columns}>
        <section className={styles.column}>
          <h3 className={styles.columnHead}>
            Source documents <span className={styles.columnCount}>{documents.length}</span>
          </h3>
          <div className={styles.nodes}>
            {documents.map((document) => (
              <DocumentTrace
                key={document.id}
                document={document}
                selected={activeDocumentIds.includes(document.id)}
                dimmed={isFiltering && !activeDocumentIds.includes(document.id)}
                onSelect={() => {
                  setRequirementId(null);
                  setDocumentId(documentId === document.id ? null : document.id);
                }}
              />
            ))}
          </div>
        </section>

        <section className={styles.column}>
          <h3 className={styles.columnHead}>
            Requirements <span className={styles.columnCount}>{requirements.length}</span>
          </h3>
          <div className={styles.nodes}>
            {requirements.length === 0 ? (
              <p className={styles.empty}>Nothing extracted yet.</p>
            ) : (
              requirements.map((requirement) => {
                const linked =
                  activeDocumentIds.length === 0 ||
                  requirement.sourceDocumentIds.some((id) => activeDocumentIds.includes(id));
                const isSelected = requirement.id === requirementId;

                return (
                  <RequirementTrace
                    key={requirement.id}
                    requirement={requirement}
                    selected={isSelected}
                    dimmed={isFiltering && !linked && !isSelected}
                    onSelect={() => {
                      setDocumentId(null);
                      setRequirementId(isSelected ? null : requirement.id);
                    }}
                  />
                );
              })
            )}
          </div>
        </section>

        <section className={styles.column}>
          <h3 className={styles.columnHead}>Acceptance criteria</h3>
          <div className={styles.nodes}>
            {visibleCriteria.filter((v) => v.criteria.length > 0).length === 0 ? (
              <p className={styles.empty}>
                No acceptance criteria on the selected requirements.
              </p>
            ) : (
              visibleCriteria
                .filter((v) => v.criteria.length > 0)
                .map(({ requirement, criteria }) => (
                  <div key={requirement.id} className={styles.criteriaGroup}>
                    <h4 className={styles.criteriaFor}>{requirement.title}</h4>
                    <ul className={styles.criteria}>
                      {criteria.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
