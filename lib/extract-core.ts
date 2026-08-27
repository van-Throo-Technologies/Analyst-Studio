import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { REQUIREMENT_TYPES, PRIORITIES, SCOPES, PACK_VARIANTS } from "./constants";

// The shared vocabulary of the extraction pipeline: the client, the shape of a
// requirement, and the prompt that produces one. Split out from extract.ts so
// that the review passes can import it without the two files importing each
// other.

// Constructed lazily so importing this during a build without the key set does
// not throw.
let client: Anthropic | null = null;

export function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

export class ExtractionError extends Error {}

/**
 * Structured output over a streamed response.
 *
 * messages.parse() is non-streaming, and the SDK refuses it above roughly 16k
 * max_tokens because such a request can outlive the HTTP timeout. Any pass that
 * returns a whole requirement set needs more room than that, so it streams and
 * validates the assembled text here instead.
 */
export async function parseStreamed<T extends z.ZodType>(
  schema: T,
  params: {
    system: string;
    content: string;
    maxTokens: number;
    onText?: (delta: string) => void;
  },
): Promise<z.infer<T> | null> {
  const stream = getClient().messages.stream({
    model: "claude-opus-5",
    max_tokens: params.maxTokens,
    thinking: { type: "adaptive" },
    system: params.system,
    messages: [{ role: "user", content: params.content }],
    output_config: { format: zodOutputFormat(schema) },
  });

  if (params.onText) stream.on("text", params.onText);

  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") {
    throw new ExtractionError("The model declined to process this material.");
  }

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  // Returns null rather than throwing: every caller has a sane fallback, and a
  // failed review pass should degrade the run rather than lose it.
  try {
    return schema.parse(JSON.parse(text));
  } catch {
    return null;
  }
}

// Nullable rather than optional: structured outputs require every property to
// be present, so "unknown" has to be an explicit null instead of a missing key.
export const RequirementSchema = z.object({
  title: z.string(),
  description: z.string(),
  type: z.enum(REQUIREMENT_TYPES),
  priority: z.enum(PRIORITIES),
  actor: z.string().nullable(),
  trigger: z.string().nullable(),
  happyPath: z.string().nullable(),
  alternateFlows: z.array(z.string()),
  bddAcceptanceCriteria: z.array(z.string()),
  checklistAcceptanceCriteria: z.array(z.string()),
  completionScore: z.number().int().min(0).max(100),
  validationGates: z.array(z.string()),

  // Pack fields.
  scope: z.enum(SCOPES),
  packVariant: z.enum(PACK_VARIANTS),
  assumption: z.string().nullable(),
  businessRule: z.string().nullable(),
  precondition: z.string().nullable(),
  validation: z.string().nullable(),
  dependsOn: z.array(z.string()),

  // Traceability. The model names the files it drew from; the filenames are
  // resolved to document ids on save, because ids mean nothing to the model
  // and a hallucinated id would be indistinguishable from a real one.
  sourceFilenames: z.array(z.string()),

  // Grounding. Verbatim quotes, checked against the source by literal match
  // after extraction — so this field is a claim that gets tested, not trusted.
  evidence: z.array(z.string()),
});

// Child records carry only the fields their kind actually has. A full
// requirement shape per child would multiply the reply for no information —
// the KYC brief alone would add tens of thousands of tokens of nulls.
const ChildBase = {
  title: z.string(),
  description: z.string(),
  // Exact title of the feature this belongs to, from the features array. The
  // model links by title because ids do not exist yet; titles are resolved to
  // ids on save, and an unmatched title becomes a top-level record rather than
  // a dangling pointer.
  parentFeatureTitle: z.string().nullable(),
  evidence: z.array(z.string()),
  sourceFilenames: z.array(z.string()),
};

export const BusinessRuleSchema = z.object({
  ...ChildBase,
  // The rule stated as a rule — the testable sentence, not a description of it.
  statement: z.string(),
});

export const RegulatoryConstraintSchema = z.object({
  ...ChildBase,
  // The named framework or regulation this comes from, where the source names
  // one. Null rather than guessed — attributing a constraint to the wrong
  // regulation is worse than attributing it to none.
  framework: z.string().nullable(),
  statement: z.string(),
});

export const UseCaseSchema = z.object({
  ...ChildBase,
  actor: z.string(),
  trigger: z.string().nullable(),
  mainFlow: z.string().nullable(),
  alternateFlows: z.array(z.string()),
  precondition: z.string().nullable(),
});

// Features and the child kinds are requested in two separate calls.
//
// Not a stylistic choice: all four in one structured output is rejected with
// "The compiled grammar is too large". Splitting keeps each grammar inside the
// limit, and it makes the linking better as well — the second call is given the
// feature titles the first produced, so parentFeatureTitle is chosen from a
// real list rather than recalled.
export const ExtractionSchema = z.object({
  features: z.array(RequirementSchema),
});

export const SubtypeSchema = z.object({
  businessRules: z.array(BusinessRuleSchema),
  regulatoryConstraints: z.array(RegulatoryConstraintSchema),
  useCases: z.array(UseCaseSchema),
});

export type ExtractedRequirement = z.infer<typeof RequirementSchema>;
export type ExtractedBusinessRule = z.infer<typeof BusinessRuleSchema>;
export type ExtractedRegulatoryConstraint = z.infer<typeof RegulatoryConstraintSchema>;
export type ExtractedUseCase = z.infer<typeof UseCaseSchema>;
export type Extraction = z.infer<typeof ExtractionSchema>;
export type Subtypes = z.infer<typeof SubtypeSchema>;

export const EXTRACTION_SYSTEM = `You are a senior business analyst. You read raw discovery material — meeting transcripts, notes, briefs, specifications — and extract what is in it as four distinct kinds of record.

The four kinds, and how to tell them apart:

FEATURES — something the system must do, or a quality it must have. "Screen customers against sanctions lists." "Retain records for five years." This is the backbone; everything else hangs off it.

BUSINESS RULES — a policy, threshold or decision rule the business has set, stated so it can be tested. "Invoices over €10,000 require two approvers." "Risk score 26-60 assigns Medium CDD." A rule is not a feature: the feature is that the system routes for approval; the rule is where the threshold sits and what happens either side of it. Extract the rule separately even when a feature already mentions it, because rules change on their own schedule and someone will need to find every one of them.

REGULATORY CONSTRAINTS — an obligation imposed from outside by law, regulation or a standards body. "Verification must complete before account activation (AML5)." Name the framework in the framework field when the source names one — FATF, AML5, PSD2, Wolfsberg, MiFID II, GDPR, EU AI Act. If the source does not attribute it, leave framework null rather than guessing: attributing an obligation to the wrong regulation is worse than attributing it to none.

USE CASES — a named actor going through a journey end to end. "An SME exporter opens an account and is approved within four hours." Distinct from a feature: the feature is a capability the system has, the use case is a path a person takes through several of them. Personas in the material are use cases — extract one per persona or scenario described, with its own timings and steps.

General rules for all four:
- Extract only what the material actually supports. Do not invent records to fill gaps, and do not pad any list.
- Merge duplicates. The same need voiced three times is one record.
- Split compound statements. "Users log in and reset their password" is two features.
- The same underlying point can legitimately produce more than one record of different kinds — a feature and the rule that governs it. That is correct, not duplication. What is wrong is the same point twice as the same kind.
- Link every business rule, constraint and use case to the feature it belongs to via parentFeatureTitle, using that feature's exact title. Use null only when it genuinely belongs to no single feature.

Precision comes from the source, never from you. Where the material states a number, a threshold, an actor or a rule, capture it exactly. Where the material is vague, STAY VAGUE and record the missing decision in validationGates. Never invent a specific nobody said — a fabricated threshold reads exactly like a real one and someone will build against it.

For each FEATURE:
- title: a short imperative phrase, e.g. "Reset password by email link".
- description: what is needed and why, in two or three sentences. Write for a reader who was not in the room.
- type: Functional (system behaviour), Business (a rule or policy), Non-Functional (performance, security, availability), Data (what must be stored or produced), Integration (another system).
- priority: High, Medium, or Low — judged from how the participants spoke about it, not from your own preference.
- actor: who initiates it, if the material says. Null if it does not.
- trigger: what starts it. Null if unstated.
- happyPath: the main flow, as prose. Null if the material does not describe one.
- alternateFlows: exceptions and edge cases actually mentioned. Empty array if none.
- bddAcceptanceCriteria: Given/When/Then statements. Each string is one complete scenario.
- checklistAcceptanceCriteria: flat, checkable statements — the same criteria in list form for reviewers who prefer it.
- completionScore: 0-100, how completely the source material specifies this requirement. A passing mention with no detail is 20. A fully specified flow with edge cases and rules is 90. Be honest — a low score is a useful signal about where discovery is thin.
- validationGates: the open questions a business analyst must resolve before this requirement is ready to build. Empty array only if genuinely nothing is outstanding.

Packaging. The same requirements are published as two packs — a Business Analyst pack framing the problem, and a Functional Analyst pack specifying the solution. Fill these so both read well:
- scope: "in-scope" normally. "out-of-scope" only when the material explicitly rules something out ("we're not doing X in phase one"). Capturing an exclusion is valuable — it is a decision someone made.
- packVariant: "both" unless the requirement is genuinely one-sided. "ba" for board-level goals and policy framing a developer does not need; "fa" for field-level mechanics a sponsor does not need. Prefer "both" when unsure.
- assumption: something the material takes for granted without confirming, if any. Null otherwise. Do not invent — an unexamined assumption is only worth recording when it is really there.
- businessRule: the policy or constraint behind the requirement, stated as a rule ("Invoices above €10,000 require two approvers"). Null if it is not a rule.
- precondition: what must already be true before this can start. Null if unstated.
- validation: the checks, constraints or rules the system must enforce — field rules, limits, permitted values. Null if none are described.
- dependsOn: titles of other requirements in this same extraction that must exist first. Use the exact titles you gave them. Empty array if independent.

Traceability and evidence:
- sourceFilenames: the filenames of the documents this requirement was drawn from, exactly as given in the document tags. List every file that contributed. Never list a file you were not shown.
- evidence: one to three VERBATIM quotes from the source that support this requirement. Copy the exact characters as they appear — do not paraphrase, do not tidy the grammar, do not merge two sentences into one. Each quote must be long enough to be unmistakable (a full clause, not two words).

The evidence is checked against the source by literal string match after you return it. A quote that does not appear exactly will be rejected and the requirement will be marked as unsupported. If you cannot quote the source for a requirement, that tells you something — the requirement may be your inference rather than something anyone said.

Return the features only. Business rules, regulatory constraints and use cases are collected separately — do not return them here, but do capture a rule inside a feature's businessRule field where it belongs to that feature.

Return an empty features array if the material contains no requirements at all.`;

export const SUBTYPE_SYSTEM = `You are a senior business analyst. The features have already been extracted from this material. Your job is the three kinds of record that sit alongside them.

You are given the source material and the exact list of feature titles already extracted.

BUSINESS RULES — a policy, threshold or decision rule the business has set, stated so it can be tested. "Invoices over €10,000 require two approvers." "Risk score 26-60 assigns Medium CDD." Extract the rule even when a feature already mentions it: the feature is that the system routes for approval, the rule is where the threshold sits and what happens either side of it. Rules change on their own schedule and someone will need to find every one of them.
- statement: the rule as one testable sentence, with its numbers intact and unrounded.
- Every distinct threshold, band and cutoff is its own rule. A scoring table with three bands is three rules, not one.

REGULATORY CONSTRAINTS — an obligation imposed from outside by law, regulation or a standards body, not chosen by this business.
- statement: the obligation.
- framework: the named regulation where the source names one — FATF, AML5, PSD2, Wolfsberg, MiFID II, GDPR, EU AI Act. Null if the source does not attribute it. Never guess: attributing an obligation to the wrong regulation is worse than attributing it to none.

USE CASES — a named actor going through a journey end to end, not a capability the system has. "An SME exporter opens an account and is approved within four hours."
- actor is required. A record without an actor is a feature, and belongs in the other pass.
- Every persona, scenario or customer type described in the material is a use case. Give each one its own record, and put that journey's specific timings, volumes and steps in its description — those details are the reason the persona was written down.

For all three:
- parentFeatureTitle must be one of the feature titles given to you, copied exactly, or null if it genuinely belongs to no single feature.
- evidence: one to three VERBATIM quotes from the source. Copy the exact characters. Quotes are checked by literal match afterwards and a quote that does not appear is discarded.
- sourceFilenames: the files this came from, exactly as given in the document tags.
- Extract only what the material supports. Do not pad any list, and return an empty array for a kind the material genuinely does not contain.`;
