import { notFound } from "next/navigation";
import { loadProjectModel, sortRequirements } from "@/lib/db/queries";
import { Card, CardBody, PageHeader } from "@/components/ui";
import { isAiConfigured } from "@/lib/ai/client";
import { DraftRequirementsButton } from "@/components/requirements/draft-buttons";
import {
  ModelTabs,
  parseModelView,
  type ModelView,
} from "@/components/requirements/model-tabs";
import { RequirementList } from "@/components/requirements/requirement-list";
import { UseCasePanel } from "@/components/requirements/use-case-panel";
import { CriteriaPanel } from "@/components/requirements/criteria-panel";
import { DependencyPanel } from "@/components/requirements/dependency-panel";
import { SimpleEntityPanel } from "@/components/requirements/simple-entity-panel";
import {
  deleteActorAction,
  deleteBusinessGoalAction,
  deleteBusinessRuleAction,
  deleteStakeholderAction,
  saveActorAction,
  saveBusinessGoalAction,
  saveBusinessRuleAction,
  saveStakeholderAction,
} from "@/app/projects/[id]/requirements/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Requirement model" };

export default async function RequirementModelPage({
  params,
  searchParams,
}: PageProps<"/projects/[id]/requirements">) {
  const { id } = await params;
  const { view: viewParam } = await searchParams;
  const view = parseModelView(
    typeof viewParam === "string" ? viewParam : undefined,
  );

  const model = await loadProjectModel(id);
  if (!model) notFound();

  const sources = model.sourceDocuments.map((s) => ({
    id: s.id,
    title: s.title,
    sourceType: s.sourceType,
  }));
  const requirementOptions = model.requirements.map((r) => ({
    id: r.id,
    ref: r.ref,
    title: r.title,
  }));

  const counts: Record<ModelView, number> = {
    requirements: model.requirements.length,
    "use-cases": model.useCases.length,
    criteria: model.acceptanceCriteria.length,
    rules: model.businessRules.length,
    context:
      model.stakeholders.length + model.actors.length + model.businessGoals.length,
    dependencies: model.dependencies.length,
  };

  // Candidates still sitting in extraction that nobody has turned into a
  // requirement — the most common reason a model looks emptier than the sources.
  const candidateCount = model.insights.filter(
    (i) => i.insightType === "requirement_candidate" && i.status !== "dismissed" && i.status !== "promoted",
  ).length;

  const useCaseCounts = countBy(model.useCases, (u) => u.requirementId);
  const criteriaCounts = countBy(model.acceptanceCriteria, (a) => a.requirementId);

  return (
    <>
      <PageHeader
        title="Requirement model"
        description="The canonical model. Everything a pack contains is generated from what is on these tabs — nothing else."
      />

      <ModelTabs projectId={id} active={view} counts={counts} />

      {view === "requirements" ? (
        <div className="space-y-4">
          {candidateCount > 0 ? (
            <Card className="border-accent-line bg-accent-soft/40">
              <CardBody className="flex flex-wrap items-center justify-between gap-3 py-3">
                <p className="text-sm text-ink-soft">
                  {candidateCount} candidate requirement
                  {candidateCount === 1 ? "" : "s"} from extraction have not been turned
                  into requirements yet.
                </p>
                <DraftRequirementsButton
                  projectId={id}
                  mode={model.project.defaultMode}
                  candidateCount={candidateCount}
                  disabled={!isAiConfigured()}
                />
              </CardBody>
            </Card>
          ) : null}

          <RequirementList
            projectId={id}
            requirements={sortRequirements(model.requirements)}
            sources={sources}
            useCaseCounts={useCaseCounts}
            criteriaCounts={criteriaCounts}
          />
        </div>
      ) : null}

      {view === "use-cases" ? (
        <UseCasePanel
          projectId={id}
          useCases={model.useCases}
          requirements={requirementOptions}
          sources={sources}
        />
      ) : null}

      {view === "criteria" ? (
        <CriteriaPanel
          projectId={id}
          criteria={model.acceptanceCriteria}
          requirements={requirementOptions}
          sources={sources}
        />
      ) : null}

      {view === "rules" ? (
        <SimpleEntityPanel
          title="Business rules"
          description="Constraints on how the business operates, independent of any solution. In FA mode these are translated into system behaviour; in BA mode they stand as policy."
          addLabel="Add business rule"
          fields={[
            {
              name: "ruleText",
              label: "Rule",
              required: true,
              multiline: true,
              placeholder:
                "Any claim involving personal injury is assigned to a senior handler.",
            },
            {
              name: "rationale",
              label: "Rationale",
              hint: "Why the rule exists. Useful when someone later asks whether it can change.",
            },
          ]}
          entities={model.businessRules.map((rule) => ({
            id: rule.id,
            primary: rule.ruleText,
            secondary: rule.rationale,
            values: { ruleText: rule.ruleText, rationale: rule.rationale },
            sourceRefs: rule.sourceRefs,
          }))}
          sources={sources}
          saveAction={saveBusinessRuleAction.bind(null, id)}
          deleteAction={deleteBusinessRuleAction.bind(null, id)}
          emptyTitle="No business rules yet"
          emptyDescription="Promote them from extraction, or add the ones you already know."
        />
      ) : null}

      {view === "context" ? (
        <div className="space-y-10">
          <SimpleEntityPanel
            title="Stakeholders"
            description="People and groups with an interest in the outcome. Gaps here are one of the most common causes of missed requirements."
            addLabel="Add stakeholder"
            fields={[
              { name: "name", label: "Name", required: true },
              { name: "role", label: "Role", placeholder: "Head of Claims" },
              { name: "notes", label: "Notes", multiline: true },
            ]}
            entities={model.stakeholders.map((s) => ({
              id: s.id,
              primary: s.role ? `${s.name} — ${s.role}` : s.name,
              secondary: s.notes,
              values: { name: s.name, role: s.role, notes: s.notes },
              sourceRefs: s.sourceRefs,
            }))}
            sources={sources}
            saveAction={saveStakeholderAction.bind(null, id)}
            deleteAction={deleteStakeholderAction.bind(null, id)}
            emptyTitle="No stakeholders yet"
            emptyDescription="The BA pack has a stakeholder section — it will be empty until this is filled in."
          />

          <SimpleEntityPanel
            title="Actors"
            description="Anyone or anything that interacts with the solution, including systems and external parties. A person can be both a stakeholder and an actor."
            addLabel="Add actor"
            fields={[
              { name: "name", label: "Name", required: true },
              { name: "description", label: "Description", multiline: true },
            ]}
            entities={model.actors.map((a) => ({
              id: a.id,
              primary: a.name,
              secondary: a.description,
              values: { name: a.name, description: a.description },
              sourceRefs: a.sourceRefs,
            }))}
            sources={sources}
            saveAction={saveActorAction.bind(null, id)}
            deleteAction={deleteActorAction.bind(null, id)}
            emptyTitle="No actors yet"
            emptyDescription="Use cases need a primary actor — add them here so they can be referenced consistently."
          />

          <SimpleEntityPanel
            title="Business goals"
            description="The outcomes the work exists to achieve. Requirements that do not serve one of these are worth questioning."
            addLabel="Add business goal"
            fields={[
              { name: "title", label: "Goal", required: true },
              { name: "description", label: "Description", multiline: true },
            ]}
            entities={model.businessGoals.map((g) => ({
              id: g.id,
              primary: g.title,
              secondary: g.description,
              values: { title: g.title, description: g.description },
              sourceRefs: g.sourceRefs,
            }))}
            sources={sources}
            saveAction={saveBusinessGoalAction.bind(null, id)}
            deleteAction={deleteBusinessGoalAction.bind(null, id)}
            emptyTitle="No business goals yet"
            emptyDescription="The BA pack opens with these. Without them the pack states what is needed but not why."
          />
        </div>
      ) : null}

      {view === "dependencies" ? (
        <DependencyPanel
          projectId={id}
          dependencies={model.dependencies}
          requirements={requirementOptions}
        />
      ) : null}
    </>
  );
}

function countBy<T>(items: T[], key: (item: T) => string | null): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k === null) continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}
