import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { prisma } from "./prisma";

import { REQUIREMENT_TYPES, PRIORITIES, SCOPES, PACK_VARIANTS } from "./constants";

export { REQUIREMENT_TYPES, PRIORITIES };

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

Packaging. The same requirements are published as two packs — a Business Analyst pack framing the problem, and a Functional Analyst pack specifying the solution. Fill these so both read well:
- scope: "in-scope" normally. "out-of-scope" only when the material explicitly rules something out ("we're not doing X in phase one"). Capturing an exclusion is valuable — it is a decision someone made.
- packVariant: "both" unless the requirement is genuinely one-sided. "ba" for board-level goals and policy framing a developer does not need; "fa" for field-level mechanics a sponsor does not need. Prefer "both" when unsure.
- assumption: something the material takes for granted without confirming, if any. Null otherwise. Do not invent — an unexamined assumption is only worth recording when it is really there.
- businessRule: the policy or constraint behind the requirement, stated as a rule ("Invoices above €10,000 require two approvers"). Null if it is not a rule.
- precondition: what must already be true before this can start. Null if unstated.
- validation: the checks, constraints or rules the system must enforce — field rules, limits, permitted values. Null if none are described.
- dependsOn: titles of other requirements in this same extraction that must exist first. Use the exact titles you gave them. Empty array if independent.

Traceability:
- sourceFilenames: the filenames of the documents this requirement was drawn from, exactly as given in the document tags. List every file that contributed. Never list a file you were not shown.

Return an empty requirements array if the material contains no requirements at all.`;

// The client reads ANTHROPIC_API_KEY from the environment. Constructed lazily so
// that importing this module during a build without the key set does not throw.
let client: Anthropic | null = null;

function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

export class ExtractionError extends Error {}

/**
 * Streams the extraction, reporting how many requirements have been written so
 * far. Streaming is what makes progress reportable at all — a single blocking
 * call can only say "still working" — and it also keeps a minute-long response
 * clear of HTTP timeouts.
 */
export async function extractRequirements(
  documents: { filename: string; content: string }[],
  onProgress?: (found: number) => void,
): Promise<ExtractedRequirement[]> {
  if (documents.length === 0) return [];

  // Documents are passed whole. Truncating here would silently drop
  // requirements from the tail of a transcript, which is worse than an error.
  const material = documents
    .map((doc) => `<document filename="${doc.filename}">\n${doc.content}\n</document>`)
    .join("\n\n");

  const stream = getClient().messages.stream({
    model: "claude-opus-5",
    max_tokens: 32000,
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

  if (onProgress) {
    let reported = 0;
    let buffer = "";

    // The output is one JSON document arriving in fragments. Each requirement
    // object opens with its "title" key, so counting those keys counts
    // completed-enough objects without needing to parse partial JSON.
    stream.on("text", (delta) => {
      buffer += delta;
      const found = (buffer.match(/"title"\s*:/g) ?? []).length;
      if (found > reported) {
        reported = found;
        onProgress(found);
      }
    });
  }

  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new ExtractionError("The model declined to process this material.");
  }

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  let parsed;
  try {
    parsed = ExtractionSchema.parse(JSON.parse(text));
  } catch {
    throw new ExtractionError(
      message.stop_reason === "max_tokens"
        ? "The material produced more requirements than fit in one response. Split it across two projects and try again."
        : "The model returned a response that did not match the expected shape.",
    );
  }

  return parsed.requirements;
}

/**
 * Writes an extraction result over the machine-generated requirements, leaving
 * hand-edited ones in place. Both statements commit or neither does.
 */
export async function saveExtraction(
  projectId: string,
  extracted: ExtractedRequirement[],
) {
  // The model names source files; ids are resolved here against the documents
  // that actually exist. A filename the project does not have is dropped rather
  // than stored, so a trace link always points at a real document.
  const documents = await prisma.sourceDocument.findMany({
    where: { projectId },
    select: { id: true, filename: true },
  });
  const idByFilename = new Map(documents.map((d) => [d.filename, d.id]));

  await prisma.$transaction([
    prisma.requirement.deleteMany({ where: { projectId, isEdited: false } }),
    prisma.requirement.createMany({
      data: extracted.map((r) => {
        const sourceIds = r.sourceFilenames
          .map((filename) => idByFilename.get(filename))
          .filter((id): id is string => Boolean(id));

        return {
          projectId,
          title: r.title,
          description: r.description,
          type: r.type,
          priority: r.priority,
          actor: r.actor,
          trigger: r.trigger,
          happyPath: r.happyPath,
          alternateFlows: r.alternateFlows.join("\n") || null,
          bdDAC: r.bddAcceptanceCriteria.join("\n") || null,
          checklistAC: r.checklistAcceptanceCriteria.join("\n") || null,
          completionScore: r.completionScore,
          validationGates: r.validationGates.join("\n") || null,
          scope: r.scope,
          packVariant: r.packVariant,
          assumption: r.assumption,
          businessRule: r.businessRule,
          precondition: r.precondition,
          validation: r.validation,
          dependency: r.dependsOn.join("\n") || null,
          // Every extraction covers the whole document set, so a requirement
          // with no named source fell back to all of them rather than none.
          sourceDocumentIds: JSON.stringify(
            sourceIds.length > 0 ? sourceIds : documents.map((d) => d.id),
          ),
        };
      }),
    }),
  ]);
}
