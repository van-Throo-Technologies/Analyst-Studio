import type { Metadata } from "next";
import Link from "next/link";

import { getRules, getRuleFacets, type RuleFilters as Filters } from "../../../lib/rules";
import { RuleCard } from "../../../components/rules/RuleCard";
import { RuleFilters } from "../../../components/rules/RuleFilters";
import styles from "../../../components/rules/rules.module.css";

export const metadata: Metadata = { title: "Rule base — Analyst Studio" };

type Params = { searchParams: Promise<Record<string, string | undefined>> };

export default async function RulesPage({ searchParams }: Params) {
  const params = await searchParams;

  const filters: Filters = {
    industry: params.industry,
    tag: params.tag,
    framework: params.framework,
    recordType: params.recordType,
    search: params.search,
    grounded: params.grounded === "true",
  };

  const page = Math.max(1, Number(params.page) || 1);

  // getRules and getRuleFacets both verify the session before reading anything.
  const [{ rules, total, pages }, facets] = await Promise.all([
    getRules(filters, page),
    getRuleFacets(filters),
  ]);

  // Carries the current filters into a page link, so paging does not silently
  // drop the query the reader built.
  const pageHref = (n: number) => {
    const next = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][],
    );
    next.set("page", String(n));
    return `/rules?${next.toString()}`;
  };

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Rule base</h1>
          <p className={styles.lede}>
            Every rule, constraint and criterion extracted so far, each quoted
            back to the document it came from.
          </p>
        </div>
        <span className={styles.total}>
          {total.toLocaleString()} {total === 1 ? "rule" : "rules"}
        </span>
      </div>

      <div className={styles.layout}>
        <RuleFilters facets={facets} />

        <div className={styles.results}>
          {rules.length === 0 ? (
            <p className={styles.empty}>
              Nothing matches those filters. That is an answer, not an error —
              try removing one.
            </p>
          ) : (
            <>
              <ul className={styles.list}>
                {rules.map((rule) => (
                  <RuleCard key={rule.id} rule={rule} />
                ))}
              </ul>

              {pages > 1 && (
                <nav className={styles.pager}>
                  {page > 1 && (
                    <Link href={pageHref(page - 1)} className={styles.pageLink}>
                      ← Previous
                    </Link>
                  )}
                  <span className={styles.pageOf}>
                    Page {page} of {pages}
                  </span>
                  {page < pages && (
                    <Link href={pageHref(page + 1)} className={styles.pageLink}>
                      Next →
                    </Link>
                  )}
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
