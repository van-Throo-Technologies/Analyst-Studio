"use client";

import { useState } from "react";
import styles from "./ProjectTabs.module.css";

export type Tab = { id: string; label: string; badge?: number; content: React.ReactNode };

// The panels are server-rendered and handed in as children, so switching tabs
// costs nothing and nothing refetches. Inactive panels stay mounted but hidden,
// which keeps scroll position and any open <details> where the reader left them.
export function ProjectTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div className={styles.wrap}>
      <div className={styles.tabs} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={active === tab.id}
            aria-controls={`panel-${tab.id}`}
            className={`${styles.tab} ${active === tab.id ? styles.tabOn : ""}`}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className={styles.badge}>{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab.id}`}
          hidden={active !== tab.id}
          className={styles.panel}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
