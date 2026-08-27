"use client";

import { useState } from "react";
import type { Pack } from "../../lib/pack-generator";
import { BAPack } from "./BAPack";
import { FAPack } from "./FAPack";
import { ExportMenu } from "../export/ExportMenu";
import styles from "./packs.module.css";

// Both packs are rendered from data already on the page, so the toggle is
// instant — no fetch, no spinner. They are two views of one requirement set,
// and switching between them should feel like that.
export function PackViewer({
  projectId,
  ba,
  fa,
  qualityScore,
}: {
  projectId: string;
  ba: Pack;
  fa: Pack;
  qualityScore: number;
}) {
  const [kind, setKind] = useState<"ba" | "fa">("ba");
  const pack = kind === "ba" ? ba : fa;

  return (
    <div className={styles.viewer}>
      <div className={styles.toolbar}>
        <div className={styles.toggle} role="tablist" aria-label="Analyst pack">
          {(["ba", "fa"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={kind === value}
              className={`${styles.toggleButton} ${kind === value ? styles.toggleOn : ""}`}
              onClick={() => setKind(value)}
            >
              {value === "ba" ? "BA Pack" : "FA Pack"}
            </button>
          ))}
        </div>

        <div className={styles.toolbarRight}>
          <span className={styles.quality} title="Quality score across all requirements">
            Quality {qualityScore}%
          </span>
          <ExportMenu projectId={projectId} packType={kind} />
        </div>
      </div>

      {kind === "ba" ? <BAPack pack={ba} /> : <FAPack pack={fa} />}
    </div>
  );
}
