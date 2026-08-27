"use client";

import { useState } from "react";
import type { QualityReport as Report } from "../../lib/quality-checker";
import { QualityReport } from "./QualityReport";
import styles from "./quality.module.css";

// The checks are deterministic and run server-side on every page render, so the
// report is already here — the button opens it rather than fetching it. There
// is no waiting, and the badge is accurate the moment the page paints.
export function QualityButton({ report }: { report: Report }) {
  const [open, setOpen] = useState(false);
  const total = report.issues.length;

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        Quality check
        {total > 0 && (
          <span className={`${styles.badge} ${report.counts.high > 0 ? styles.badgeHigh : ""}`}>
            {total}
          </span>
        )}
      </button>

      {open && (
        <div
          className={styles.backdrop}
          role="dialog"
          aria-modal="true"
          aria-label="Quality report"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className={styles.modal}>
            <header className={styles.modalHead}>
              <h2 className={styles.modalTitle}>Quality report</h2>
              <button
                type="button"
                className={styles.close}
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </header>

            <div className={styles.modalBody}>
              <QualityReport report={report} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
