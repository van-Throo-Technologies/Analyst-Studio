// Run with: node lib/grounding.test.mjs
//
// A plain script rather than a framework — this project has no test runner yet,
// and these rules are the ones worth pinning down: the whole pipeline's claim to
// trustworthiness rests on paraphrase failing this check.
import assert from "node:assert";
import { isQuoteInSource, verifyEvidence } from "./grounding.ts";

const SOURCE = `Marcus: Policy says anything over ten thousand euro needs a second signature.
Priya: We're assuming everyone already has an SSO account — that's how they'll log in.`;

const cases = [
  ["exact quote matches", "anything over ten thousand euro needs a second signature", true],
  ["extra whitespace tolerated", "anything  over   ten thousand euro needs a second signature", true],
  ["curly apostrophe tolerated", "We’re assuming everyone already has an SSO account", true],
  ["em dash tolerated", "an SSO account — that's how they'll log in", true],
  ["paraphrase rejected", "anything above 10000 EUR requires two signatures", false],
  ["changed number rejected", "anything over twenty thousand euro needs a second signature", false],
  ["trivially short quote rejected", "the system", false],
];

for (const [name, quote, expected] of cases) {
  assert.equal(isQuoteInSource(quote, SOURCE), expected, name);
  console.log(`  ✓ ${name}`);
}

const mixed = verifyEvidence(
  ["anything over ten thousand euro needs a second signature", "invented text not in the source"],
  SOURCE,
);
assert.equal(mixed.verified.length, 1);
assert.equal(mixed.unverified.length, 1);
assert.equal(mixed.isGrounded, false, "one bad quote spoils the requirement");
console.log("  ✓ one unverifiable quote makes the requirement ungrounded");

assert.equal(verifyEvidence([], SOURCE).isGrounded, false, "no evidence is not grounded");
console.log("  ✓ offering no evidence is not grounded");

console.log("grounding: all assertions passed");
