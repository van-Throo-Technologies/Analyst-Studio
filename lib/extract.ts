import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

export const REQUIREMENT_TYPES = [
  "Functional",
  "Business",
  "Non-Functional",
  "Data",
  "Integration",
] as const;

export const PRIORITIES = ["High", "Medium", "Low"] as const;

// Nullable rather than optional: structured outputs require every property to
// be present, so "unknown" has to be an explicit null instead of a missing key.
const RequirementSchema = z.object({
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
});

const ExtractionSchema = z.object({
  requirements: z.array(RequirementSchema),
});

export type ExtractedRequirement = z.infer<typeof RequirementSchema>;

const SYSTEM = `You are a senior business analyst. You read raw discovery material — meeting transcripts, notes, emails — and extract the requirements hiding inside them.

What you are looking for:
- A requirement is something the system must do, or a constraint it must honour. It is not a topic, an opinion, or a discussion point.
- Extract only what the material actually supports. Do not invent requirements to fill gaps, and do not pad the list.
- Merge duplicates. The same need voiced three times in a conversation is one requirement.
- Split compound statements. "Users log in and reset their password" is two requirements.

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

Return an empty requirements array if the material contains no requirements at all.`;

// The client reads ANTHROPIC_API_KEY from the environment. Constructed lazily so
// that importing this module during a build without the key set does not throw.
let client: Anthropic | null = null;

function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

export async function extractRequirements(
  documents: { filename: string; content: string }[],
): Promise<ExtractedRequirement[]> {
  if (documents.length === 0) return [];

  // Documents are passed whole. Truncating here would silently drop
  // requirements from the tail of a transcript, which is worse than an error.
  const material = documents
    .map((doc) => `<document filename="${doc.filename}">\n${doc.content}\n</document>`)
    .join("\n\n");

  const response = await getClient().messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Extract the requirements from the following discovery material.\n\n${material}`,
      },
    ],
    output_config: { format: zodOutputFormat(ExtractionSchema) },
  });

  // parsed_output is null when the model could not satisfy the schema — for
  // example if it refused. Treating that as "no requirements" would look like a
  // successful run that found nothing, so it is surfaced as a failure instead.
  if (!response.parsed_output) {
    throw new Error(
      response.stop_reason === "refusal"
        ? "The model declined to process this material."
        : "The model returned a response that did not match the expected shape.",
    );
  }

  return response.parsed_output.requirements;
}
