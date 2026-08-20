"use client";

import { useMemo, useState } from "react";
import {
  bulkInsightStatusAction,
  deleteInsightAction,
  promoteInsightAction,
  promoteInsightsAction,
  setInsightStatusAction,
  updateInsightAction,
} from "@/app/projects/[id]/extraction/actions";
import type { FormState } from "@/lib/forms";
import type { ExtractedInsight } from "@/lib/schemas/entities";
import {
  INSIGHT_TYPE_LABELS,
  INSIGHT_TYPE_ORDER,
  type InsightStatus,
  type InsightType,
} from "@/lib/schemas/enums";
import { cn, formatDate, truncate } from "@/lib/utils";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Textarea,
} from "@/components/ui";
import { ConfidenceBadge, InsightStatusBadge } from "@/components/ui/badges";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionState } from "react";

/**
 * The review surface. Grouped by insight type because that is how an analyst
 * thinks about the pass — "who are the stakeholders", then "what are the rules"
 * — rather than by source, which would scatter the same concept across sections.
 *
 * Insight types that become entities carry a Promote action; assumptions,
 * constraints and risks are accepted into the project register instead.
 */

/** Singular form, for the button on a single insight. */
const PROMOTE_TARGET_SINGULAR: Record<InsightType, string> = {
  stakeholder: "stakeholder",
  actor: "actor",
  goal: "business goal",
  business_rule: "business rule",
  requirement_candidate: "requirement",
  assumption: "the assumption register",
  constraint: "the constraint register",
  risk: "the risk register",
};

const PROMOTE_TARGET: Record<InsightType, string> = {
  stakeholder: "stakeholders",
  actor: "actors",
  goal: "business goals",
  business_rule: "business rules",
  requirement_candidate: "requirements",
  assumption: "the assumption register",
  constraint: "the constraint register",
  risk: "the risk register",
};

/** What the review surface needs to know about the document behind an insight. */
export type InsightSource = {
  id: string;
  title: string;
  uploadedByName: string | null;
  uploaderRole: string | null;
  validatedAt: Date | null;
};

export function InsightReview({
  projectId,
  insights,
  sources,
}: {
  projectId: string;
  insights: ExtractedInsight[];
  sources: InsightSource[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showReviewed, setShowReviewed] = useState(false);
  const [activeType, setActiveType] = useState<InsightType | "all">("all");

  const sourceById = useMemo(
    () => new Map(sources.map((s) => [s.id, s])),
    [sources],
  );

  const inScope = showReviewed
    ? insights
    : insights.filter((i) => i.status === "pending");

  // Counts come from everything in scope, not from the filtered view — a tab
  // reading "Risks (4)" has to keep saying 4 once you are standing on it.
  const countsByType = useMemo(() => {
    const map = new Map<InsightType, number>();
    for (const insight of inScope) {
      map.set(insight.insightType, (map.get(insight.insightType) ?? 0) + 1);
    }
    return map;
  }, [inScope]);

  const visible =
    activeType === "all"
      ? inScope
      : inScope.filter((i) => i.insightType === activeType);

  const grouped = useMemo(() => {
    const map = new Map<InsightType, ExtractedInsight[]>();
    for (const insight of visible) {
      const list = map.get(insight.insightType) ?? [];
      list.push(insight);
      map.set(insight.insightType, list);
    }
    return map;
  }, [visible]);

  const pendingCount = insights.filter((i) => i.status === "pending").length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(items: ExtractedInsight[]) {
    const ids = items.map((i) => i.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {pendingCount > 0
            ? `${pendingCount} awaiting review`
            : "Everything has been reviewed"}
          {insights.length !== pendingCount
            ? ` · ${insights.length - pendingCount} already handled`
            : ""}
        </p>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={showReviewed}
            onChange={(e) => setShowReviewed(e.target.checked)}
            className="accent-accent"
          />
          Show reviewed items
        </label>
      </div>

      <nav className="flex flex-wrap gap-1.5" aria-label="Filter insights by type">
        <TypeTab
          label="All"
          count={inScope.length}
          active={activeType === "all"}
          onClick={() => setActiveType("all")}
        />
        {INSIGHT_TYPE_ORDER.map((type) => (
          <TypeTab
            key={type}
            label={INSIGHT_TYPE_LABELS[type]}
            count={countsByType.get(type) ?? 0}
            active={activeType === type}
            onClick={() => setActiveType(type)}
          />
        ))}
      </nav>

      {selected.size > 0 ? (
        <BulkBar
          projectId={projectId}
          selectedIds={[...selected]}
          onDone={() => setSelected(new Set())}
        />
      ) : null}

      {INSIGHT_TYPE_ORDER.map((type) => {
        const items = grouped.get(type);
        if (!items || items.length === 0) return null;

        return (
          <Card key={type}>
            <CardHeader>
              <CardTitle>
                {INSIGHT_TYPE_LABELS[type]}
                <span className="ml-2 font-normal text-ink-faint">{items.length}</span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-ink-faint">
                  → {PROMOTE_TARGET[type]}
                </span>
                <Button size="sm" variant="ghost" onClick={() => toggleGroup(items)}>
                  Select group
                </Button>
              </div>
            </CardHeader>
            <ul className="divide-y divide-line">
              {items.map((insight) => (
                <InsightRow
                  key={insight.id}
                  projectId={projectId}
                  insight={insight}
                  source={sourceById.get(insight.sourceDocumentId)}
                  selected={selected.has(insight.id)}
                  onToggle={() => toggle(insight.id)}
                />
              ))}
            </ul>
          </Card>
        );
      })}

      {visible.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm text-ink-muted">
              Nothing left to review. Turn on “Show reviewed items” to see what you
              already handled.
            </p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function BulkBar({
  projectId,
  selectedIds,
  onDone,
}: {
  projectId: string;
  selectedIds: string[];
  onDone: () => void;
}) {
  const [promoteState, promoteAction] = useActionState<FormState, FormData>(
    promoteInsightsAction.bind(null, projectId),
    null,
  );
  const [statusState, statusAction] = useActionState<FormState, FormData>(
    bulkInsightStatusAction.bind(null, projectId),
    null,
  );

  const message = promoteState?.message ?? statusState?.message;
  const failed =
    (promoteState && !promoteState.ok) || (statusState && !statusState.ok);

  return (
    <Card className="sticky top-16 z-10 border-accent-line">
      <CardBody className="py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-ink">
            {selectedIds.length} selected
          </span>

          <form action={promoteAction} onSubmit={() => setTimeout(onDone, 0)}>
            {selectedIds.map((id) => (
              <input key={id} type="hidden" name="insightIds" value={id} />
            ))}
            <SubmitButton size="sm" pendingLabel="Converting…">
              Convert to entities
            </SubmitButton>
          </form>

          <form action={statusAction} onSubmit={() => setTimeout(onDone, 0)}>
            {selectedIds.map((id) => (
              <input key={id} type="hidden" name="insightIds" value={id} />
            ))}
            <input type="hidden" name="status" value="dismissed" />
            <SubmitButton size="sm" variant="secondary" pendingLabel="Dismissing…">
              Dismiss
            </SubmitButton>
          </form>

          <Button size="sm" variant="ghost" onClick={onDone}>
            Clear selection
          </Button>

          {message ? (
            <span className={cn("text-xs", failed ? "text-critical" : "text-positive")}>
              {message}
            </span>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

function InsightRow({
  projectId,
  insight,
  source,
  selected,
  onToggle,
}: {
  projectId: string;
  insight: ExtractedInsight;
  source: InsightSource | undefined;
  selected: boolean;
  onToggle: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(
    updateInsightAction.bind(null, projectId, insight.id),
    null,
  );
  const [promoteState, promoteFormAction] = useActionState<FormState, FormData>(
    promoteInsightAction.bind(null, projectId, insight.id),
    null,
  );

  const locked = insight.status === "promoted";
  const target = PROMOTE_TARGET_SINGULAR[insight.insightType];

  return (
    <li className={cn("px-5 py-3", selected && "bg-accent-soft/40")}>
      <div className="flex gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          disabled={locked}
          aria-label="Select insight"
          className="mt-1 accent-accent disabled:opacity-40"
        />

        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              action={formAction}
              onSubmit={() => setTimeout(() => setEditing(false), 0)}
              className="space-y-2"
            >
              <Textarea
                name="normalizedText"
                defaultValue={insight.normalizedText}
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <SubmitButton size="sm" pendingLabel="Saving…">
                  Save
                </SubmitButton>
                <Button size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm leading-relaxed text-ink">{insight.normalizedText}</p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-faint">
            <InsightStatusBadge status={insight.status} />
            <ConfidenceBadge value={insight.confidence} />
            <span title="Where this came from, and who stands behind it">
              from {source?.title ?? "Unknown source"}
              {source?.uploadedByName
                ? ` · by ${source.uploadedByName}${source.uploaderRole ? ` (${source.uploaderRole})` : ""}`
                : ""}
              {source?.validatedAt
                ? ` · validated ${formatDate(source.validatedAt)}`
                : ""}
            </span>
            {insight.userEdited ? <span className="text-accent">edited</span> : null}
            <button
              type="button"
              onClick={() => setShowSource((v) => !v)}
              className="underline underline-offset-2 hover:text-ink-soft"
            >
              {showSource ? "Hide" : "Show"} source text
            </button>
          </div>

          {showSource ? (
            <blockquote className="mt-2 border-l-2 border-line-strong bg-surface-muted px-3 py-2 font-mono text-xs leading-relaxed text-ink-muted">
              {insight.rawText}
            </blockquote>
          ) : null}

          {promoting ? (
            <form
              action={promoteFormAction}
              onSubmit={() => setTimeout(() => setPromoting(false), 0)}
              className="mt-3 space-y-2 rounded-md border border-line bg-surface-muted p-3"
            >
              <p className="text-xs text-ink-muted">
                Promoting to {target}. Edit before saving — this is what enters the
                requirement model.
              </p>
              <Field label="Title" htmlFor={`promote-title-${insight.id}`}>
                <Input
                  id={`promote-title-${insight.id}`}
                  name="title"
                  defaultValue={truncate(insight.normalizedText, 140)}
                  maxLength={200}
                />
              </Field>
              <Field label="Description" htmlFor={`promote-desc-${insight.id}`}>
                <Textarea
                  id={`promote-desc-${insight.id}`}
                  name="description"
                  rows={3}
                  defaultValue={insight.normalizedText}
                />
              </Field>
              <p className="text-[11px] text-ink-faint">
                Traced back to this source automatically.
              </p>
              {promoteState && !promoteState.ok ? (
                <p className="text-xs text-critical">{promoteState.message}</p>
              ) : null}
              <div className="flex gap-2">
                <SubmitButton size="sm" pendingLabel="Promoting…">
                  Promote to {target}
                </SubmitButton>
                <Button size="sm" onClick={() => setPromoting(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}

          {state && !state.ok ? (
            <p className="mt-1 text-xs text-critical">{state.message}</p>
          ) : null}
        </div>

        {!locked ? (
          <div className="flex shrink-0 items-start gap-1">
            {!editing && !promoting ? (
              <Button size="sm" variant="ghost" onClick={() => setPromoting(true)}>
                Promote
              </Button>
            ) : null}
            {!editing ? (
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                Edit
              </Button>
            ) : null}
            <StatusButton
              projectId={projectId}
              insightId={insight.id}
              status={insight.status === "dismissed" ? "pending" : "dismissed"}
              label={insight.status === "dismissed" ? "Restore" : "Dismiss"}
            />
            <DeleteButton projectId={projectId} insightId={insight.id} />
          </div>
        ) : (
          <span
            className="shrink-0 text-[11px] text-ink-faint"
            title={truncate(`Promoted to ${insight.promotedToType ?? "an entity"}`, 60)}
          >
            in model
          </span>
        )}
      </div>
    </li>
  );
}

function StatusButton({
  projectId,
  insightId,
  status,
  label,
}: {
  projectId: string;
  insightId: string;
  status: InsightStatus;
  label: string;
}) {
  return (
    <form action={setInsightStatusAction.bind(null, projectId, insightId, status)}>
      <SubmitButton size="sm" variant="ghost" pendingLabel="…">
        {label}
      </SubmitButton>
    </form>
  );
}

function DeleteButton({
  projectId,
  insightId,
}: {
  projectId: string;
  insightId: string;
}) {
  return (
    <form action={deleteInsightAction.bind(null, projectId, insightId)}>
      <SubmitButton size="sm" variant="ghost" className="text-critical" pendingLabel="…">
        Delete
      </SubmitButton>
    </form>
  );
}

/**
 * One filter tab. Zero-count types stay visible but muted — knowing that a
 * source produced no risks at all is information, and hiding the tab makes it
 * look like the category does not exist.
 */
function TypeTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs transition-colors",
        active
          ? "border-accent bg-accent text-white"
          : count === 0
            ? "border-line text-ink-faint hover:bg-surface-muted"
            : "border-line-strong text-ink-soft hover:bg-surface-muted",
      )}
    >
      {label}
      <span className={cn("ml-1.5 tabular-nums", active ? "text-white/70" : "text-ink-faint")}>
        {count}
      </span>
    </button>
  );
}
