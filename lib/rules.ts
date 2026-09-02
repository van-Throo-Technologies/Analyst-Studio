import "server-only";

import { prisma } from "./prisma";
import { verifySession } from "./dal";

// Reading the rule base for the UI.
//
// The rule base is reference material derived from documents the user uploaded,
// so it is guarded like everything else — but it is not scoped per project: a
// rule about retention is worth finding whichever engagement produced it.

export type RuleFilters = {
  industry?: string;
  tag?: string;
  framework?: string;
  recordType?: string;
  search?: string;
  grounded?: boolean;
};

const PAGE_SIZE = 50;

function whereFrom(filters: RuleFilters) {
  // % and _ are LIKE wildcards; escaped so a search means what it says.
  const literal = (term: string) => term.replace(/[\\%_]/g, (c) => `\\${c}`);

  return {
    ...(filters.industry && { industry: filters.industry }),
    ...(filters.tag && { tags: { has: filters.tag } }),
    ...(filters.framework && { regulatoryFrameworks: { has: filters.framework } }),
    ...(filters.recordType && { recordType: filters.recordType }),
    ...(filters.grounded && { isGrounded: true }),
    ...(filters.search && {
      OR: [
        { title: { contains: literal(filters.search), mode: "insensitive" as const } },
        { description: { contains: literal(filters.search), mode: "insensitive" as const } },
        { quote: { contains: literal(filters.search), mode: "insensitive" as const } },
      ],
    }),
  };
}

export async function getRules(filters: RuleFilters, page = 1) {
  await verifySession();
  const where = whereFrom(filters);

  const [rules, total] = await Promise.all([
    prisma.ruleBase.findMany({
      where,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      // Grounded first: a rule backed by a verified quote deserves to be seen
      // before an inferred one.
      orderBy: [{ isGrounded: "desc" }, { title: "asc" }],
      select: {
        id: true,
        recordType: true,
        industry: true,
        title: true,
        description: true,
        quote: true,
        sourceDocument: true,
        tags: true,
        regulatoryFrameworks: true,
        isGrounded: true,
      },
    }),
    prisma.ruleBase.count({ where }),
  ]);

  return { rules, total, page, pageSize: PAGE_SIZE, pages: Math.ceil(total / PAGE_SIZE) };
}

/**
 * The facets, counted against the filters currently applied.
 *
 * Counting against the filtered set rather than the whole corpus is what stops
 * the UI offering a filter that would return nothing — a dead end the reader
 * only discovers by clicking it.
 */
export async function getRuleFacets(filters: RuleFilters) {
  await verifySession();

  const matching = await prisma.ruleBase.findMany({
    where: whereFrom(filters),
    select: {
      industry: true,
      recordType: true,
      tags: true,
      regulatoryFrameworks: true,
      isGrounded: true,
    },
  });

  const tally = (values: string[]) => {
    const counts = new Map<string, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };

  return {
    industries: tally(matching.map((r) => r.industry)),
    recordTypes: tally(matching.map((r) => r.recordType)),
    tags: tally(matching.flatMap((r) => r.tags)),
    frameworks: tally(matching.flatMap((r) => r.regulatoryFrameworks)),
    grounded: matching.filter((r) => r.isGrounded).length,
    total: matching.length,
  };
}

export type RuleRecord = Awaited<ReturnType<typeof getRules>>["rules"][number];
export type RuleFacets = Awaited<ReturnType<typeof getRuleFacets>>;
