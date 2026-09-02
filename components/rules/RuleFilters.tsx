"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import type { RuleFacets } from "../../lib/rules";
import { RECORD_TYPE_LABELS, INDUSTRY_LABELS } from "../../lib/constants";
import styles from "./rules.module.css";

// Filters live in the URL, not in component state. A filtered view is then
// something you can bookmark, share with a colleague, or reload without losing
// — and the back button behaves the way a reader expects.
export function RuleFilters({ facets }: { facets: RuleFacets }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || next.get(key) === value) next.delete(key);
    else next.set(key, value);
    // Any filter change invalidates the page number.
    next.delete("page");
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  const active = (key: string, value: string) => params.get(key) === value;
  const hasFilters = ["industry", "tag", "framework", "recordType", "search", "grounded"].some(
    (k) => params.get(k),
  );

  function Group({
    label,
    param,
    entries,
    labels,
    limit = 12,
  }: {
    label: string;
    param: string;
    entries: [string, number][];
    labels?: Record<string, string>;
    limit?: number;
  }) {
    if (entries.length === 0) return null;
    return (
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{label}</h3>
        <div className={styles.chipRow}>
          {entries.slice(0, limit).map(([value, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => setParam(param, value)}
              className={`${styles.filterChip} ${active(param, value) ? styles.filterOn : ""}`}
            >
              {labels?.[value] ?? value}
              <span className={styles.count}>{count}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <aside className={`${styles.filters} ${pending ? styles.pending : ""}`}>
      <form
        className={styles.searchRow}
        action={(formData) => setParam("search", String(formData.get("search") ?? "").trim() || null)}
      >
        <label htmlFor="search" className={styles.srOnly}>
          Search rules
        </label>
        <input
          id="search"
          name="search"
          type="search"
          defaultValue={params.get("search") ?? ""}
          placeholder="Search titles, descriptions and quotes…"
          className={styles.search}
        />
      </form>

      <div className={styles.group}>
        <button
          type="button"
          onClick={() => setParam("grounded", "true")}
          className={`${styles.filterChip} ${active("grounded", "true") ? styles.filterOn : ""}`}
        >
          Evidence-backed only
          <span className={styles.count}>{facets.grounded}</span>
        </button>
      </div>

      <Group label="Industry" param="industry" entries={facets.industries} labels={INDUSTRY_LABELS} />
      <Group label="Record type" param="recordType" entries={facets.recordTypes} labels={RECORD_TYPE_LABELS} />
      <Group label="Framework" param="framework" entries={facets.frameworks} />
      <Group label="Tag" param="tag" entries={facets.tags} limit={24} />

      {hasFilters && (
        <button type="button" className={styles.clear} onClick={() => router.push(pathname)}>
          Clear all filters
        </button>
      )}
    </aside>
  );
}
