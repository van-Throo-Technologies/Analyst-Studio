"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * The project sidebar doubles as the workflow itself: the order of these items
 * is the order of the analysis — intake, extract, model, generate, check,
 * export. Counts sit on the right so an analyst can see at a glance where the
 * work still is.
 */

export type NavItem = {
  segment: string;
  label: string;
  count?: number;
  /** Rendered instead of a count — used for the open-issue indicator. */
  badge?: "attention" | null;
};

export function ProjectNav({
  projectId,
  items,
}: {
  projectId: string;
  items: NavItem[];
}) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  return (
    <nav aria-label="Project sections" className="space-y-0.5">
      {items.map((item) => {
        const href = item.segment ? `${base}/${item.segment}` : base;
        const active = item.segment
          ? pathname === href || pathname.startsWith(`${href}/`)
          : pathname === base;

        return (
          <Link
            key={item.segment || "overview"}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              active
                ? "bg-accent-soft font-medium text-accent"
                : "text-ink-soft hover:bg-surface-muted hover:text-ink",
            )}
          >
            <span className="truncate">{item.label}</span>
            {item.badge === "attention" ? (
              <span
                aria-label="has open issues"
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning"
              />
            ) : typeof item.count === "number" && item.count > 0 ? (
              <span className="shrink-0 text-xs tabular-nums text-ink-faint">
                {item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
