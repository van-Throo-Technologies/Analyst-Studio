import { NextRequest, NextResponse } from "next/server";

import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { INDUSTRIES, RECORD_TYPES } from "@/lib/constants";

/**
 * GET /api/features/rules
 *
 * The rules engine's read side. Every filter is a database query — no model
 * call, so this costs nothing to run and returns the same answer every time.
 *
 * Query parameters, all optional and all combinable:
 *   industry   omit to search every industry
 *   tag        rules carrying this tag, e.g. CDD, Sanctions
 *   framework  rules citing this regulation, e.g. AML5, FATF
 *   recordType feature | business-rule | regulatory-constraint | use-case |
 *              acceptance-criteria
 *   search     substring of the title, description or source quote
 *   grounded   "true" to return only rules whose quote was verified
 *   limit      1-500, default 100
 */

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

export async function GET(request: NextRequest) {
  // The rule base is derived from documents users uploaded, so it is their
  // content and not public reference data. Guarded like every other route.
  await verifySession();

  const params = request.nextUrl.searchParams;
  // No default industry. Defaulting to one silently hides every rule belonging
  // to the others, and "no results" would look identical to "nothing matched".
  // Omitting the parameter searches everything; passing it narrows.
  const industry = params.get("industry");
  const tag = params.get("tag");
  const framework = params.get("framework");
  const recordType = params.get("recordType");
  const search = params.get("search");
  const grounded = params.get("grounded");
  const limitParam = params.get("limit");

  // Bad input gets a specific message rather than an empty result set. An empty
  // array is a real answer — "nothing matched" — and it should never also be
  // what a typo looks like.
  if (industry && !INDUSTRIES.includes(industry as (typeof INDUSTRIES)[number])) {
    return NextResponse.json(
      { success: false, error: `Unknown industry "${industry}". Expected one of: ${INDUSTRIES.join(", ")}.` },
      { status: 400 },
    );
  }

  if (recordType && !RECORD_TYPES.includes(recordType as (typeof RECORD_TYPES)[number])) {
    return NextResponse.json(
      { success: false, error: `Unknown recordType "${recordType}". Expected one of: ${RECORD_TYPES.join(", ")}.` },
      { status: 400 },
    );
  }

  const limit = limitParam ? Number(limitParam) : DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return NextResponse.json(
      { success: false, error: `limit must be a whole number between 1 and ${MAX_LIMIT}.` },
      { status: 400 },
    );
  }

  // Prisma's `contains` passes the term straight into LIKE, so % and _ act as
  // wildcards: searching for "2%" matched anything containing a 2. Escaping
  // them makes the search mean what it says. Backslash is Postgres's default
  // LIKE escape character.
  const literal = (term: string) => term.replace(/[\\%_]/g, (c) => `\\${c}`);

  try {
    // Filters compose rather than override each other: asking for CDD rules
    // under AML5 should narrow to their intersection, not silently drop one of
    // the two conditions. Searching is done in the query, not in JavaScript
    // after a page of results, so it matches across the whole table.
    const where = {
      ...(industry && { industry }),
      ...(recordType && { recordType }),
      ...(tag && { tags: { has: tag } }),
      ...(framework && { regulatoryFrameworks: { has: framework } }),
      ...(grounded === "true" && { isGrounded: true }),
      ...(search && {
        OR: [
          { title: { contains: literal(search), mode: "insensitive" as const } },
          { description: { contains: literal(search), mode: "insensitive" as const } },
          { quote: { contains: literal(search), mode: "insensitive" as const } },
        ],
      }),
    };

    const [rules, total] = await Promise.all([
      prisma.ruleBase.findMany({
        where,
        take: limit,
        // Grounded rules first: a rule backed by a verified quote is the one a
        // reader should see before an inferred one.
        orderBy: [{ isGrounded: "desc" }, { title: "asc" }],
        select: {
          id: true,
          recordType: true,
          // Returned since the corpus went multi-industry: without it a caller
          // filtering across industries cannot tell which one a rule came from,
          // and a shared tag like Privacy returns an undifferentiated list.
          industry: true,
          title: true,
          description: true,
          quote: true,
          sourceDocument: true,
          tags: true,
          regulatoryFrameworks: true,
          parentRuleId: true,
          isGrounded: true,
          confidence: true,
        },
      }),
      prisma.ruleBase.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        rules,
        // count is what came back, total is what matched. They differ when the
        // limit truncates, and conflating them would understate the result.
        count: rules.length,
        total,
        truncated: total > rules.length,
        industry: industry ?? "all",
        filters: {
          tag: tag ?? null,
          framework: framework ?? null,
          recordType: recordType ?? null,
          search: search ?? null,
          grounded: grounded === "true" ? true : null,
          limit,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching rules:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch rules" },
      { status: 500 },
    );
  }
}
