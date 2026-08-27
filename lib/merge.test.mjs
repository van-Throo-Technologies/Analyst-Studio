// Run with: node lib/merge.test.mjs
import assert from "node:assert";
import { similarity, mergeDuplicates, featureRichness } from "./merge.ts";

const rec = (title, description, evidence = [], sourceFilenames = []) =>
  ({ title, description, evidence, sourceFilenames });

// --- similarity ---------------------------------------------------------
assert.ok(similarity("Screen customers against sanctions lists", "Screen customers against sanctions lists") > 0.99);
assert.ok(similarity("Screen customers against sanctions lists at onboarding",
                     "Screen customers against sanctions lists weekly") > 0.6);
assert.ok(similarity("Retain records for five years", "Screen customers against sanctions") < 0.2);
console.log("  ✓ similarity separates same-topic from different-topic");

// --- the same requirement from two documents merges ---------------------
const dupes = [
  rec("Screen customers against sanctions lists",
      "Customers must be screened against OFAC and EU lists before activation.",
      ["quote A"], ["1-regulatory.md"]),
  rec("Screen customers against sanctions lists",
      "Screening runs at account creation and weekly thereafter.",
      ["quote B"], ["2-technical.md"]),
];
const { merged, collapsed } = mergeDuplicates(dupes, r => r.description.length);
assert.equal(merged.length, 1, "identical titles collapse to one");
assert.equal(collapsed, 1);
console.log("  ✓ same requirement from two documents collapses to one");

// --- traceability survives the merge ------------------------------------
assert.deepEqual(merged[0].sourceFilenames.sort(), ["1-regulatory.md", "2-technical.md"]);
assert.deepEqual(merged[0].evidence.sort(), ["quote A", "quote B"]);
console.log("  ✓ survivor keeps evidence and source files from BOTH documents");

// --- genuinely different requirements are not merged --------------------
const distinct = [
  rec("Screen customers against sanctions lists", "Sanctions screening at onboarding."),
  rec("Retain approval records for seven years", "Audit retention obligation."),
  rec("Notify suppliers of rejection reasons", "Legal obligation on rejection."),
];
assert.equal(mergeDuplicates(distinct, () => 1).merged.length, 3, "distinct requirements survive");
console.log("  ✓ three distinct requirements are left alone");

// --- near-misses that must NOT merge (a false merge destroys data) ------
const nearMiss = [
  rec("Screen customers against sanctions lists", "Screen the customer at onboarding."),
  rec("Screen suppliers against sanctions lists", "Screen the customer's suppliers and counterparties."),
];
assert.equal(mergeDuplicates(nearMiss, () => 1).merged.length, 2,
  "customer screening and supplier screening are different requirements");
console.log("  ✓ customer-screening vs supplier-screening stay separate");

// --- the richer record wins ---------------------------------------------
const rich = {
  ...rec("Calculate risk score", "Weighted decision tree over profile factors."),
  bddAcceptanceCriteria: ["Given...When...Then"], checklistAcceptanceCriteria: ["a","b"],
  validationGates: ["who signs off?"], alternateFlows: [], happyPath: "flow", actor: "Risk engine",
  completionScore: 80,
};
const thin = {
  ...rec("Calculate risk score", "A score is produced."),
  bddAcceptanceCriteria: [], checklistAcceptanceCriteria: [], validationGates: [],
  alternateFlows: [], happyPath: null, actor: null, completionScore: 20,
};
assert.ok(featureRichness(rich) > featureRichness(thin));
const winner = mergeDuplicates([thin, rich], featureRichness).merged[0];
assert.equal(winner.description, rich.description, "richer record survives regardless of order");
console.log("  ✓ the more complete of two duplicates is the one kept");

console.log("merge: all assertions passed");
