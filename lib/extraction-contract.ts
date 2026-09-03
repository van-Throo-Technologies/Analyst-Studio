/**
 * The rules both extraction paths must state identically.
 *
 * There are two places that ask the model to turn documents into records:
 * `lib/extract-core.ts` (the in-app pipeline) and
 * `scripts/extract-documents.ts` (the offline corpus builder). They produce
 * different shapes for different tables and that difference is deliberate — see
 * AGENTS.md. What is *not* deliberate is the two of them separately wording the
 * rules that make either one trustworthy, and drifting apart as they are edited.
 *
 * Those rules live here. Both prompts compose from these functions, so the
 * grounding contract is written once and changing it changes both.
 *
 * No "server-only", on purpose: `extract-core.ts` carries it, which makes that
 * module unimportable from a `tsx` script — importing it throws "This module
 * cannot be imported from a Client Component module". That is exactly why the
 * script grew its own copy in the first place. Keep this file free of it, and
 * free of any import that pulls it back in.
 *
 * The parameters exist because the two paths name things differently — one
 * collects an array of `evidence`, the other a single `quote` — not because the
 * rule itself differs. Anything that varies is a parameter; anything that is
 * the same is text.
 */

/**
 * Take the numbers from the source, never from yourself.
 *
 * @param recordVaguenessIn - the field an unresolved decision belongs in, for
 *   callers whose schema has one. Omitted, the instruction just says to stay
 *   vague, because telling the model to record something it has nowhere to put
 *   invites it to invent a place.
 */
export function precisionContract(
  options: { recordVaguenessIn?: string } = {},
): string {
  const vague = options.recordVaguenessIn
    ? `Where the material is vague, STAY VAGUE and record the missing decision in ${options.recordVaguenessIn}.`
    : `Where the material is vague, STAY VAGUE.`;

  return `Precision comes from the source, never from you. Where the material states a number, a threshold, an actor or a rule, capture it exactly. ${vague} Never invent a specific nobody said — a fabricated threshold reads exactly like a real one and someone will build against it.`;
}

/**
 * How to quote: the field instruction that sits with the other field rules.
 *
 * The tail — copy exactly, do not tidy, make it long enough to be
 * unmistakable — is the part that has to be identical everywhere, because it is
 * what makes the literal match downstream survivable. Only the lead-in varies,
 * since one path collects an array and the other a single string.
 *
 * @param field - the schema field the quotes go in.
 * @param lead - the cardinality and origin as a phrase, e.g. "one to three
 *   VERBATIM quotes from the source that support this requirement". Passed
 *   whole rather than assembled from parts, so the caller keeps its own subject
 *   agreement instead of the helper guessing at it.
 */
export function quotingRule(options: { field: string; lead: string }): string {
  return `${options.field}: ${options.lead}. Copy the exact characters as they appear — do not paraphrase, do not tidy the grammar, do not merge two sentences into one. Each quote must be long enough to be unmistakable (a full clause, not two words).`;
}

/**
 * What happens to a quote that turns out not to be real.
 *
 * This is the load-bearing sentence of the whole design. `lib/grounding.ts`
 * checks every quote by literal match after the model returns it, so the model
 * is told plainly that the claim will be tested. Both paths run that same
 * check; only what they call a record that fails it differs.
 *
 * @param subject - how that path refers to the quotes it asked for, e.g.
 *   "The evidence" or "The quote".
 * @param consequence - what becomes of a record whose quote does not verify,
 *   in that path's own vocabulary.
 */
export function literalMatchContract(options: {
  subject: string;
  consequence: string;
}): string {
  return `${options.subject} is checked against the source by literal string match after you return it. ${options.consequence}`;
}

/**
 * The four record kinds, as one-line definitions.
 *
 * Only the distinctions are here — what separates a feature from the rule that
 * governs it, and a use case from a capability — because those are what the two
 * prompts must not disagree about. Each path expands on them in its own prompt:
 * the in-app pipeline can afford several paragraphs because it makes one call
 * over the whole brief, while the script pays for its prompt on every section
 * of every document and stays terse. Expanding is fine. Contradicting is not.
 *
 * Note that the *sets* differ legitimately: the script also emits
 * `acceptance-criteria` as its own record, whereas the in-app pipeline carries
 * acceptance criteria as fields on a feature. That is a difference of table
 * shape, not of meaning, so there is no shared definition for it here.
 */
export const KIND_DEFINITIONS = {
  feature: `something the system must do, or a quality it must have`,
  "business-rule": `a policy, threshold or decision rule the business has set, stated so it can be tested. The feature is that the system routes for approval; the rule is where the threshold sits and what happens either side of it. Every distinct threshold or band is its own rule — a table with three tiers is three rules`,
  "regulatory-constraint": `an obligation imposed from outside by law, regulation or a standards body, not chosen by this business. Name the framework only where the source names it — never guess, because attributing an obligation to the wrong regulation is worse than attributing it to none`,
  "use-case": `a named actor going through a journey end to end, not a capability the system has. Requires an actor: a record without one is a feature`,
} as const;
