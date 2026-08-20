import {
  isBaPack,
  type BaPack,
  type FaPack,
  type Pack,
  type PackCriterion,
  type PackRequirement,
  type PackUseCase,
} from "@/lib/pack-builders/types";

/**
 * Markdown renderer.
 *
 * Renders from the pack JSON only — it never touches the database — so the
 * Markdown, HTML and JSON exports of a pack are guaranteed to say the same
 * thing. Every item keeps its ref so a reader can quote "REQ-004" back and be
 * pointing at exactly one thing.
 */

export function renderPackMarkdown(pack: Pack): string {
  return isBaPack(pack) ? renderBa(pack) : renderFa(pack);
}

function renderBa(pack: BaPack): string {
  const out: string[] = [];

  out.push(`# ${pack.meta.projectName} — Business Analysis Pack`);
  out.push(provenance(pack));

  out.push("## 1. Project overview");
  out.push(pack.overview.trim() || "_Not written._");

  out.push("## 2. Business problem");
  out.push(pack.businessProblem.trim() || "_Not written._");

  out.push("## 3. Business goals");
  out.push(
    pack.businessGoals.length === 0
      ? "_No business goals recorded._"
      : pack.businessGoals
          .map((g) =>
            [`**${g.title}**`, g.description, sourceNote(g.sourceRefs, pack)]
              .filter(Boolean)
              .join("  \n"),
          )
          .join("\n\n"),
  );

  out.push("## 4. Stakeholders");
  out.push(
    pack.stakeholders.length === 0
      ? "_No stakeholders recorded._"
      : table(
          ["Stakeholder", "Role", "Notes"],
          pack.stakeholders.map((s) => [s.name, s.role || "—", s.notes || "—"]),
        ),
  );

  out.push("## 5. Scope");
  out.push(pack.scope.summary.trim() || "_Not written._");
  if (pack.scope.inScope.length > 0) {
    out.push("**In scope**");
    out.push(bullets(pack.scope.inScope));
  }
  if (pack.scope.outOfScope.length > 0) {
    out.push("**Out of scope**");
    out.push(bullets(pack.scope.outOfScope));
  }

  out.push("## 6. Assumptions and constraints");
  out.push("### Assumptions");
  out.push(
    pack.assumptions.length === 0
      ? "_None recorded._"
      : bullets(pack.assumptions.map((a) => a.text)),
  );
  out.push("### Constraints");
  out.push(
    pack.constraints.length === 0
      ? "_None recorded._"
      : bullets(pack.constraints.map((c) => c.text)),
  );

  out.push("## 7. Business rules");
  out.push(
    pack.businessRules.length === 0
      ? "_No business rules recorded._"
      : pack.businessRules
          .map((r) =>
            [
              `**${r.ref}** — ${r.ruleText}`,
              r.rationale ? `_Rationale:_ ${r.rationale}` : "",
              sourceNote(r.sourceRefs, pack),
            ]
              .filter(Boolean)
              .join("  \n"),
          )
          .join("\n\n"),
  );

  out.push("## 8. High-level requirements");
  out.push(renderRequirements(pack.requirements, pack));

  out.push("## 9. High-level use cases");
  out.push(renderUseCases(pack.highLevelUseCases, pack));

  out.push("## 10. Business acceptance criteria");
  out.push(renderCriteria(pack.acceptanceCriteria));

  out.push("## 11. Risks and open questions");
  out.push("### Risks");
  out.push(
    pack.risks.length === 0 ? "_None recorded._" : bullets(pack.risks.map((r) => r.text)),
  );
  out.push("### Open questions");
  out.push(
    pack.openQuestions.length === 0 ? "_None._" : bullets(pack.openQuestions),
  );

  out.push(sourceAppendix(pack));

  return out.join("\n\n").trim() + "\n";
}

function renderFa(pack: FaPack): string {
  const out: string[] = [];

  out.push(`# ${pack.meta.projectName} — Functional Analysis Pack`);
  out.push(provenance(pack));

  out.push("## 1. Project overview");
  out.push(pack.overview.trim() || "_Not written._");

  out.push("## 2. Functional scope");
  out.push(pack.functionalScope.trim() || "_Not written._");

  out.push("## 3. Functional requirements");
  out.push(renderRequirements(pack.functionalRequirements, pack));

  out.push("## 4. Business rules impacting solution behaviour");
  out.push(
    pack.businessRulesImpactingBehavior.length === 0
      ? "_No business rules recorded._"
      : pack.businessRulesImpactingBehavior
          .map((r) =>
            [
              `**${r.ref}** — ${r.ruleText}`,
              r.rationale ? `_Rationale:_ ${r.rationale}` : "",
              sourceNote(r.sourceRefs, pack),
            ]
              .filter(Boolean)
              .join("  \n"),
          )
          .join("\n\n"),
  );

  out.push("## 5. Detailed use cases");
  out.push(renderUseCases(pack.detailedUseCases, pack));

  out.push("## 6. Data and validation considerations");
  out.push(
    pack.dataValidationConsiderations.length === 0
      ? "_None recorded._"
      : bullets(pack.dataValidationConsiderations),
  );

  out.push("## 7. Dependencies");
  out.push(
    pack.dependencies.length === 0
      ? "_No dependencies recorded._"
      : table(
          ["From", "Relationship", "To", "Notes"],
          pack.dependencies.map((d) => [
            d.fromRef,
            d.dependencyType.replace(/_/g, " "),
            d.toRef,
            d.notes || "—",
          ]),
        ),
  );

  out.push("## 8. Non-functional considerations");
  out.push(
    pack.nonFunctionalConsiderations.length === 0
      ? "_None recorded._"
      : bullets(pack.nonFunctionalConsiderations),
  );

  out.push("## 9. Functional acceptance criteria");
  out.push(renderCriteria(pack.acceptanceCriteria));

  out.push("## 10. Risks and open questions");
  out.push("### Risks");
  out.push(
    pack.risks.length === 0 ? "_None recorded._" : bullets(pack.risks.map((r) => r.text)),
  );
  out.push("### Open questions");
  out.push(pack.openQuestions.length === 0 ? "_None._" : bullets(pack.openQuestions));

  out.push(sourceAppendix(pack));

  return out.join("\n\n").trim() + "\n";
}

// ---------------------------------------------------------------------------

function provenance(pack: Pack): string {
  const date = new Date(pack.meta.generatedAt);
  return [
    `_Generated ${date.toISOString().slice(0, 16).replace("T", " ")} UTC from the Analyst Studio requirement model._`,
    pack.meta.narrativeSource === "ai"
      ? `_Narrative sections written by ${pack.meta.model} using prompt ${pack.meta.narrativePromptId}@${pack.meta.narrativePromptVersion}. All listed items are reproduced verbatim from the model._`
      : "_Narrative sections were not generated. All listed items are reproduced verbatim from the model._",
  ].join("  \n");
}

function renderRequirements(requirements: PackRequirement[], pack: Pack): string {
  if (requirements.length === 0) return "_No requirements recorded._";

  return requirements
    .map((r) => {
      const parts = [`### ${r.ref} — ${r.title}`];
      parts.push(
        `_${titleCase(r.requirementType)} · ${titleCase(r.priority)} priority · ${titleCase(r.status)}${r.owner ? ` · Owner: ${r.owner}` : ""}_`,
      );
      if (r.description) parts.push(r.description);
      if (r.rationale) parts.push(`**Rationale.** ${r.rationale}`);
      if (r.assumptions.length > 0) {
        parts.push(`**Assumptions**\n${bullets(r.assumptions)}`);
      }
      if (r.constraints.length > 0) {
        parts.push(`**Constraints**\n${bullets(r.constraints)}`);
      }
      if (r.acceptanceCriteriaRefs.length > 0) {
        parts.push(`**Verified by** ${r.acceptanceCriteriaRefs.join(", ")}`);
      }
      const note = sourceNote(r.sourceRefs, pack);
      if (note) parts.push(note);
      return parts.join("\n\n");
    })
    .join("\n\n");
}

function renderUseCases(useCases: PackUseCase[], pack: Pack): string {
  if (useCases.length === 0) return "_No use cases recorded._";

  return useCases
    .map((u) => {
      const parts = [`### ${u.ref} — ${u.title}`];
      const meta = [
        `_${titleCase(u.scopeLevel.replace(/_/g, " "))}_`,
        u.realisesRequirementRef ? `_Realises ${u.realisesRequirementRef}_` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      parts.push(meta);

      const facts: [string, string][] = [
        ["Primary actor", u.primaryActor || "—"],
        ["Supporting actors", u.supportingActors.join(", ") || "—"],
        ["Trigger", u.trigger || "—"],
      ];
      parts.push(facts.map(([k, v]) => `- **${k}:** ${v}`).join("\n"));

      if (u.preconditions.length > 0) {
        parts.push(`**Preconditions**\n${bullets(u.preconditions)}`);
      }
      if (u.mainFlow.length > 0) {
        parts.push(`**Main flow**\n${numbered(u.mainFlow)}`);
      }
      for (const flow of u.alternateFlows) {
        parts.push(`**Alternate flow — ${flow.name}**\n${numbered(flow.steps)}`);
      }
      for (const flow of u.exceptionFlows) {
        parts.push(`**Exception flow — ${flow.name}**\n${numbered(flow.steps)}`);
      }
      if (u.postconditions.length > 0) {
        parts.push(`**Postconditions**\n${bullets(u.postconditions)}`);
      }

      const note = sourceNote(u.sourceRefs, pack);
      if (note) parts.push(note);
      return parts.join("\n\n");
    })
    .join("\n\n");
}

function renderCriteria(criteria: PackCriterion[]): string {
  if (criteria.length === 0) return "_No acceptance criteria recorded._";

  const byRequirement = new Map<string, PackCriterion[]>();
  for (const criterion of criteria) {
    const key = criterion.verifiesRequirementRef ?? "Unattached";
    const list = byRequirement.get(key) ?? [];
    list.push(criterion);
    byRequirement.set(key, list);
  }

  return [...byRequirement.entries()]
    .map(([requirementRef, items]) =>
      [
        `**${requirementRef === "Unattached" ? "Not attached to a requirement" : requirementRef}**`,
        table(
          ["Ref", "Type", "Criterion"],
          items.map((c) => [c.ref, titleCase(c.criterionType), c.text]),
        ),
      ].join("\n\n"),
    )
    .join("\n\n");
}

function sourceAppendix(pack: Pack): string {
  if (pack.meta.sourceDocuments.length === 0) return "";
  return [
    "---",
    "## Appendix — source documents",
    "Every item above cites the sources it was derived from.",
    "",
    bullets(pack.meta.sourceDocuments.map((s) => s.title)),
  ].join("\n");
}

function sourceNote(sourceRefs: string[], pack: Pack): string {
  if (sourceRefs.length === 0) return "";
  const titles = sourceRefs
    .map((id) => pack.meta.sourceDocuments.find((s) => s.id === id)?.title)
    .filter((t): t is string => Boolean(t));
  if (titles.length === 0) return "";
  return `_Source: ${titles.join("; ")}_`;
}

function bullets(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function numbered(items: string[]): string {
  return items.map((item, i) => `${i + 1}. ${item}`).join("\n");
}

function table(headers: string[], rows: string[][]): string {
  const escape = (cell: string) => cell.replace(/\|/g, "\\|").replace(/\n/g, " ");
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escape).join(" | ")} |`),
  ].join("\n");
}

function titleCase(value: string): string {
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
