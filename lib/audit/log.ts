import "server-only";
import { prisma } from "@/lib/db/client";
import { toProjectAuditEntry } from "@/lib/db/mappers";
import type {
  Project,
  ProjectAuditEntry,
  ProjectChange,
} from "@/lib/schemas/entities";
import {
  ANALYSIS_MODE_LABELS,
  INDUSTRY_LABELS,
  JURISDICTION_LABELS,
  PROJECT_STATUS_LABELS,
  REGULATORY_SENSITIVITY_LABELS,
  SCENARIO_TYPE_LABELS,
  type AuditAction,
} from "@/lib/schemas/enums";

/**
 * Project audit log.
 *
 * Append-only. Nothing in the app updates or deletes an entry — that is the
 * whole value of it, and the reason this module exposes no update helper.
 *
 * Each entry carries both a structured `changes` array and a human summary.
 * The structured form is what a compliance view will query; the summary is what
 * a person reads. Writing only the summary would make the log unqueryable;
 * writing only the structured form would make it unreadable.
 */

/** Used when an action has no person behind it: a migration, a backfill. */
export const SYSTEM_ACTOR = "system";

export async function recordProjectAudit(options: {
  projectId: string;
  action: AuditAction;
  /** The acting user. Omit only for genuine system actions. */
  userId?: string | null;
  entityType?: string;
  entityId?: string | null;
  changes?: ProjectChange[];
  changesSummary: string;
  /** Label for the actor when `userId` is absent. */
  changedBy?: string;
}): Promise<void> {
  await prisma.projectAuditLog.create({
    data: {
      projectId: options.projectId,
      userId: options.userId ?? null,
      action: options.action,
      entityType: options.entityType ?? "project",
      entityId: options.entityId ?? null,
      changesJson: JSON.stringify(options.changes ?? []),
      changesSummary: options.changesSummary,
      changedBy: options.changedBy ?? SYSTEM_ACTOR,
    },
  });
}

export async function listProjectAudit(
  projectId: string,
  take = 20,
): Promise<ProjectAuditEntry[]> {
  const rows = await prisma.projectAuditLog.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take,
    include: { user: true },
  });
  return rows.map(toProjectAuditEntry);
}

/**
 * The fields an audit entry reports on, with a label and a display function.
 *
 * Enum-valued fields are rendered through their label maps rather than logged
 * raw: an entry reading "Industry: Other → Insurance" is useful a year later in
 * a way that "industry: insurance" is not.
 */
type AuditableField = {
  key: keyof Project;
  label: string;
  display: (project: Project) => string;
};

const AUDITED_FIELDS: AuditableField[] = [
  { key: "name", label: "name", display: (p) => p.name },
  { key: "description", label: "description", display: (p) => p.description },
  { key: "analysisGoal", label: "analysis goal", display: (p) => p.analysisGoal },
  {
    key: "industry",
    label: "industry",
    display: (p) => INDUSTRY_LABELS[p.industry],
  },
  { key: "subdomain", label: "subdomain", display: (p) => p.subdomain ?? "" },
  {
    key: "jurisdiction",
    label: "jurisdiction",
    display: (p) => (p.jurisdiction ? JURISDICTION_LABELS[p.jurisdiction] : ""),
  },
  {
    key: "regulatorySensitivity",
    label: "regulatory sensitivity",
    display: (p) => REGULATORY_SENSITIVITY_LABELS[p.regulatorySensitivity],
  },
  {
    key: "solutionDomain",
    label: "solution domain",
    display: (p) => p.solutionDomain ?? "",
  },
  { key: "domainContext", label: "domain notes", display: (p) => p.domainContext },
  {
    key: "scenarioType",
    label: "scenario",
    display: (p) => SCENARIO_TYPE_LABELS[p.scenarioType],
  },
  {
    key: "defaultMode",
    label: "default mode",
    display: (p) => ANALYSIS_MODE_LABELS[p.defaultMode],
  },
  {
    key: "status",
    label: "status",
    display: (p) => PROJECT_STATUS_LABELS[p.status],
  },
];

/** Which audited fields actually differ between two versions of a project. */
export function diffProject(before: Project, after: Project): ProjectChange[] {
  const changes: ProjectChange[] = [];

  for (const field of AUDITED_FIELDS) {
    if (before[field.key] === after[field.key]) continue;
    changes.push({
      label: field.label,
      from: field.display(before),
      to: field.display(after),
    });
  }

  return changes;
}

/**
 * Turns a diff into one readable line.
 *
 * Short enum-ish changes are shown with their values ("status: Draft →
 * In review") because the value is the information. Long free-text fields are
 * named but not quoted — the old and new text of an analysis goal would swamp
 * the log and is recoverable from the field itself.
 */
export function summarizeChanges(changes: ProjectChange[]): string {
  if (changes.length === 0) return "No fields changed";

  const parts = changes.map((change) => {
    const short = change.from.length <= 40 && change.to.length <= 40;
    if (!short) return `Updated ${change.label}`;
    const from = change.from.length === 0 ? "not set" : change.from;
    const to = change.to.length === 0 ? "not set" : change.to;
    return `${change.label}: ${from} → ${to}`;
  });

  return capitalise(parts.join("; "));
}

/**
 * A settings change that touches `status` is logged as "status_changed", since
 * that is the transition someone scanning the log is usually looking for.
 */
export function actionForChanges(changes: ProjectChange[]): AuditAction {
  return changes.some((c) => c.label === "status")
    ? "status_changed"
    : "settings_changed";
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
