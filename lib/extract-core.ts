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

export const ExtractionSchema = z.object({
  requirements: z.array(RequirementSchema),
});

export type ExtractedRequirement = z.infer<typeof RequirementSchema>;

export const EXTRACTION_SYSTEM = `You are a senior business analyst. You read raw discovery material — meeting transcripts, notes, emails — and extract the requirements hiding inside them.

What you are looking for:
- A requirement is something the system must do, or a constraint it must honour. It is not a topic, an opinion, or a discussion point.
- Extract only what the material actually supports. Do not invent requirements to fill gaps, and do not pad the list.
- Merge duplicates. The same need voiced three times in a conversation is one requirement.
- Split compound statements. "Users log in and reset their password" is two requirements.

Precision comes from the source, never from you. Where the material states a number, a threshold, an actor or a rule, capture it exactly. Where the material is vague, STAY VAGUE and record the missing decision in validationGates. Never invent a specific nobody said — a fabricated threshold reads exactly like a real one and someone will build against it.

For each requirement:
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

Return an empty requirements array if the material contains no requirements at all.`;
