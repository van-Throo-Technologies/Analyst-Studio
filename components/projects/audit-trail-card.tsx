import type { ProjectAuditEntry } from "@/lib/schemas/entities";
import { AUDIT_ACTION_LABELS } from "@/lib/schemas/enums";
import { displayName } from "@/lib/auth/display-name";
import { formatDateTime } from "@/lib/utils";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui";

/**
 * Project history. Append-only, newest first.
 *
 * Attribution shows the person where there was one, and the system label
 * otherwise — a migration or backfill is honestly not a person, and inventing a
 * user for it would be worse than saying so.
 */
export function AuditTrailCard({ entries }: { entries: ProjectAuditEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
        <span className="text-xs text-ink-faint">
          {entries.length === 0
            ? "No entries"
            : `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
        </span>
      </CardHeader>

      {entries.length === 0 ? (
        <CardBody>
          <p className="text-sm text-ink-muted">
            Nothing recorded yet. Changes to project settings are logged here from
            now on.
          </p>
        </CardBody>
      ) : (
        <ul className="divide-y divide-line">
          {entries.map((entry) => (
            <li key={entry.id} className="px-5 py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm text-ink">
                  {AUDIT_ACTION_LABELS[entry.action]}
                </span>
                <span className="text-[11px] text-ink-faint">
                  {formatDateTime(entry.createdAt)} ·{" "}
                  {entry.user ? (
                    <span className="text-ink-muted">{displayName(entry.user)}</span>
                  ) : (
                    <span title="No user behind this action">{entry.changedBy}</span>
                  )}
                </span>
              </div>
              {entry.changesSummary ? (
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                  {entry.changesSummary}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
