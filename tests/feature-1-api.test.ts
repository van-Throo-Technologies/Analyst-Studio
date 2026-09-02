/**
 * Feature 1 Rules Engine API tests.
 *
 * Runs against the live RuleBase through the running dev server, so it proves
 * the endpoint works with real data rather than with a mock.
 *
 * Usage: npm run dev            (in another terminal)
 *        npx tsx tests/feature-1-api.test.ts
 */

import { PrismaClient } from "@prisma/client";
import fs from "node:fs";

for (const file of [".env", ".env.local"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const INDUSTRY = "financial-services";

const prisma = new PrismaClient();

type TestCase = {
  name: string;
  query: Record<string, string>;
  /** Compared against `total`, the number of matching rules — not the page. */
  expectedMinCount?: number;
  /** Every returned rule must be one of these, when given. */
  expectedRuleTypes?: string[];
  /** Expect a 400 with this text in the message. */
  expectedError?: string;
};

const tests: TestCase[] = [
  { name: "Tag filter: CDD", query: { tag: "CDD" }, expectedMinCount: 180 },
  { name: "Framework filter: AML5", query: { framework: "AML5" }, expectedMinCount: 10 },
  {
    name: "Type filter: use-case",
    query: { recordType: "use-case" },
    expectedMinCount: 10,
    expectedRuleTypes: ["use-case"],
  },
  { name: "Search: beneficial ownership", query: { search: "beneficial ownership" }, expectedMinCount: 5 },
  {
    name: "Composition: tag=CDD & recordType=business-rule",
    query: { tag: "CDD", recordType: "business-rule" },
    expectedMinCount: 50,
    expectedRuleTypes: ["business-rule"],
  },
  { name: "Composition: framework=FATF & tag=KYC", query: { framework: "FATF", tag: "KYC" }, expectedMinCount: 1 },
  { name: "Composition: tag=PEP & recordType=use-case", query: { tag: "PEP", recordType: "use-case" }, expectedMinCount: 1 },
  { name: "Grounded rules only", query: { grounded: "true" }, expectedMinCount: 500 },

  // A filter that is valid but matches nothing must be an empty result, not an
  // error — "nothing matched" and "you typed it wrong" are different answers.
  { name: "Valid tag with no matches", query: { tag: "NoSuchTag" }, expectedMinCount: 0 },

  // Bad input is rejected rather than silently returning everything.
  { name: "Rejects unknown industry", query: { industry: "banana" }, expectedError: "Unknown industry" },
  { name: "Rejects unknown recordType", query: { recordType: "nonsense" }, expectedError: "Unknown recordType" },
  { name: "Rejects out-of-range limit", query: { limit: "9999" }, expectedError: "limit must be" },

  // % is a SQL LIKE wildcard; it must be treated as a literal character.
  { name: "Search treats % literally", query: { search: "%" }, expectedMinCount: 0 },
];

async function main() {
  console.log("Feature 1 Rules Engine API tests\n");
  console.log(`  base url: ${BASE_URL}`);
  console.log(`  industry: ${INDUSTRY}\n`);

  // The endpoint is session-guarded, so the test needs a real session. Without
  // one every request redirects to sign-in and every assertion fails for a
  // reason that has nothing to do with the query.
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("No user in the database to create a test session for.");
  const token = `apitest-${Date.now()}`;
  await prisma.session.create({
    data: { sessionToken: token, userId: user.id, expires: new Date(Date.now() + 36e5) },
  });

  let passed = 0;
  const failures: string[] = [];

  try {
    for (const test of tests) {
      const params = new URLSearchParams({ industry: INDUSTRY, ...test.query });
      const url = `${BASE_URL}/api/features/rules?${params.toString()}`;

      let body: any;
      let status: number;
      try {
        // redirect: manual — a redirect means the session was not accepted, and
        // following it would return a sign-in page that fails to parse as JSON
        // and hide the real cause.
        const response = await fetch(url, {
          headers: { cookie: `authjs.session-token=${token}` },
          redirect: "manual",
        });
        status = response.status;
        if (status >= 300 && status < 400) {
          failures.push(`${test.name}: redirected (${status}) — the session was not accepted`);
          console.log(`  FAIL  ${test.name} — redirected to sign-in`);
          continue;
        }
        body = await response.json();
      } catch (error) {
        failures.push(`${test.name}: ${error instanceof Error ? error.message : error}`);
        console.log(`  FAIL  ${test.name} — ${error instanceof Error ? error.message : error}`);
        continue;
      }

      if (test.expectedError) {
        if (status === 400 && !body.success && String(body.error).includes(test.expectedError)) {
          console.log(`  ok    ${test.name} — rejected: ${body.error}`);
          passed++;
        } else {
          failures.push(`${test.name}: expected a 400 mentioning "${test.expectedError}", got ${status}`);
          console.log(`  FAIL  ${test.name} — expected rejection, got ${status}`);
        }
        continue;
      }

      if (!body.success) {
        failures.push(`${test.name}: ${body.error}`);
        console.log(`  FAIL  ${test.name} — ${body.error}`);
        continue;
      }

      // total, not rules.length: the page is capped by `limit`, so comparing the
      // page size against a threshold above it fails a query that is correct.
      const total = body.data.total;
      const returned = body.data.count;

      if (test.expectedMinCount !== undefined && total < test.expectedMinCount) {
        failures.push(`${test.name}: expected at least ${test.expectedMinCount}, got ${total}`);
        console.log(`  FAIL  ${test.name} — ${total} < ${test.expectedMinCount}`);
        continue;
      }

      if (test.expectedRuleTypes) {
        const wrong = body.data.rules.filter(
          (r: any) => !test.expectedRuleTypes!.includes(r.recordType),
        );
        if (wrong.length > 0) {
          failures.push(`${test.name}: ${wrong.length} rule(s) of an unexpected recordType`);
          console.log(`  FAIL  ${test.name} — ${wrong.length} wrong recordType`);
          continue;
        }
      }

      const sample = body.data.rules[0];
      const detail = sample
        ? `e.g. "${sample.title.slice(0, 52)}"${sample.quote ? " (quoted)" : ""}`
        : "no matches";
      console.log(`  ok    ${test.name} — total=${total}, returned=${returned}, ${detail}`);
      passed++;
    }
  } finally {
    await prisma.session.delete({ where: { sessionToken: token } }).catch(() => {});
  }

  console.log(`\n${passed}/${tests.length} passed`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(`  ${f}`));
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error("Test run failed:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
