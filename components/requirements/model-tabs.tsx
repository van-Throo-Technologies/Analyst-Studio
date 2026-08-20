import Link from "next/link";
import { cn } from "@/lib/utils";

export const MODEL_VIEWS = [
  { key: "requirements", label: "Requirements" },
  { key: "use-cases", label: "Use cases" },
  { key: "criteria", label: "Acceptance criteria" },
  { key: "rules", label: "Business rules" },
  { key: "context", label: "Stakeholders & actors" },
  { key: "dependencies", label: "Dependencies" },
] as const;

export type ModelView = (typeof MODEL_VIEWS)[number]["key"];

export function parseModelView(value: string | undefined): ModelView {
  const match = MODEL_VIEWS.find((v) => v.key === value);
  return match?.key ?? "requirements";
}

/**
 * Server-rendered tabs. Using a URL parameter rather than client state means a
 * view is linkable — quality findings and the trace view can point straight at
 * the tab holding the thing they are talking about.
 */
export function ModelTabs({
  projectId,
  active,
  counts,
}: {
  projectId: string;
  active: ModelView;
  counts: Record<ModelView, number>;
}) {
  return (
    <nav
      aria-label="Model sections"
      className="mb-5 flex flex-wrap gap-1 border-b border-line"
    >
      {MODEL_VIEWS.map((view) => {
        const isActive = view.key === active;
        return (
          <Link
            key={view.key}
            href={`/projects/${projectId}/requirements?view=${view.key}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
              isActive
                ? "border-accent font-medium text-accent"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {view.label}
            <span className="text-xs tabular-nums text-ink-faint">
              {counts[view.key]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
