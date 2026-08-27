import "server-only";

import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import {
  getClient,
  parseStreamed,
  RequirementSchema,
  type ExtractedRequirement,
} from "./extract-core";
import { isQuoteInSource } from "./grounding";
import type { QualityIssue } from "./quality-checker";

// The passes that run after extraction and before anything is saved.
//
// The governing rule for all three: the source is the only authority. A pass may
// sharpen wording the source already supports, and it may say "nobody answered
// this" — but it may never supply a fact nobody said. Inventing a threshold
// looks identical in the output to a real one, and that is the failure this
// pipeline exists to prevent.

const MODEL = "claude-opus-5";

// ------------------------------------------------------------------ repair

const RepairSchema = z.object({
  requirements: z.array(RequirementSchema),
});

const REPAIR_SYSTEM = `You are revising a set of extracted requirements before they are published.

You are given the original source material, the current requirements, and a list of problems found in them. Return the full corrected set — every requirement, revised or not, in the same order.

There are exactly two kinds of problem, and they are handled in opposite ways.

1. The requirement is vague but the SOURCE IS NOT. Someone said the precise thing and the requirement failed to capture it. Fix it. Go back to the source, find the specific number, actor, condition or rule, and write it in. This is the main job.

Example: the source says "anything over ten thousand euro needs a second signature" and the requirement says "high-value invoices are routed appropriately". Rewrite it to state the threshold and the number of approvers.

2. The requirement is vague BECAUSE THE SOURCE IS VAGUE. Nobody ever said the precise thing.

DO NOT FIX THESE. Do not invent a number, a threshold, a timeout, a permission model or an actor that nobody stated. A fabricated specific is worse than an honest gap, because a reader cannot tell it from a real one and will build against it.

Instead: keep the requirement honest about what is actually known, and add the missing decision to validationGates as a question for a person to answer.

Example: the source says "it should be quick and easy". Do not write "responds within 200ms". Write that responsiveness matters, and add "What response time is acceptable, and who decides?" to validationGates.

Also:
- Acceptance criteria must be checkable. Where the source supports it, restate them so a tester could pass or fail them. Where it does not, that is a validation gate, not an invention.
- Every requirement keeps its evidence quotes. Quotes must be VERBATIM from the source — copy the exact characters. If you rewrite a requirement, re-check that its quotes still support what it now says.
- Do not drop requirements. Do not merge them unless the problem list explicitly says they are duplicates.
- Keep sourceFilenames accurate for what the requirement now says.`;

export async function repairRequirements(
  requirements: ExtractedRequirement[],
  material: string,
  issues: QualityIssue[],
): Promise<ExtractedRequirement[]> {
  if (requirements.length === 0 || issues.length === 0) return requirements;

  const problems = issues
    .map((issue) => `- [${issue.severity}] "${issue.requirementTitle}": ${issue.message} ${issue.suggestion}`)
    .join("\n");

  // Streamed: the reply restates the whole requirement set, which is far more
  // than a non-streaming request is allowed to produce.
  const parsed = await parseStreamed(RepairSchema, {
    system: REPAIR_SYSTEM,
    content: `Source material:\n\n${material}\n\nCurrent requirements:\n\n${JSON.stringify(requirements, null, 2)}\n\nProblems found:\n\n${problems}`,
    maxTokens: 32000,
  });

  // A failed repair is not a failed extraction — the originals are still good
  // enough to publish, so the pass degrades rather than losing the run.
  return parsed?.requirements ?? requirements;
}

// ---------------------------------------------------------------- coverage

const CoverageSchema = z.object({
  // How many distinct requirement-bearing points the source contains in total,
  // covered or not. The denominator for the coverage figure.
  totalRequirementBearingPoints: z.number().int().min(0),
  gaps: z.array(
    z.object({
      quote: z.string(),
      title: z.string(),
      whyItMatters: z.string(),
      severity: z.enum(["high", "medium", "low"]),
    }),
  ),
});

const COVERAGE_SYSTEM = `You are auditing a requirements extraction for things it missed.

You are given source material and the list of requirement titles extracted from it. Your job is to find requirement-bearing content in the source that NO requirement in the list represents.

Read the source as if the extraction does not exist, then check each point against the list.

Count as requirement-bearing:
- something the system must do, or a constraint it must honour
- a rule, policy, limit or permission
- an explicit exclusion ("we're not doing X") — a recorded decision is a finding, not an absence
- an unresolved question that blocks a decision

Do NOT count as requirement-bearing: greetings, scheduling, opinions about people, restatements of a point already counted.

For every gap:
- quote: the exact words from the source, copied VERBATIM. Copy the characters as they appear. A quote that is not in the source is worse than no quote, because it will be checked.
- title: what the missing requirement would be called.
- whyItMatters: what goes wrong if it stays missing.
- severity: high if building without it causes rework, low if it is a detail.

Also report totalRequirementBearingPoints: your honest count of ALL requirement-bearing points in the source, both covered and missed. Return an empty gaps array if the extraction genuinely caught everything.`;

export type CoverageGap = z.infer<typeof CoverageSchema>["gaps"][number];

export type CoverageResult = { score: number; gaps: CoverageGap[] };

export async function findCoverageGaps(
  requirements: ExtractedRequirement[],
  material: string,
): Promise<CoverageResult> {
  const titles = requirements.map((r) => `- ${r.title}`).join("\n");

  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: COVERAGE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Source material:\n\n${material}\n\nRequirements already extracted:\n\n${titles || "(none)"}`,
      },
    ],
    output_config: { format: zodOutputFormat(CoverageSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) return { score: 100, gaps: [] };

  // A gap the model cannot quote is not evidence of a gap. Dropping the
  // unverifiable ones is what stops this pass inventing work.
  const gaps = parsed.gaps.filter((gap) => isQuoteInSource(gap.quote, material));

  const total = Math.max(parsed.totalRequirementBearingPoints, requirements.length + gaps.length);
  const score = total === 0 ? 100 : Math.round(((total - gaps.length) / total) * 100);

  return { score: Math.max(0, Math.min(100, score)), gaps };
}

// ------------------------------------------------------- domain expectations

const DomainSchema = z.object({
  domain: z.string(),
  gaps: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      severity: z.enum(["high", "medium", "low"]),
    }),
  ),
});

const DOMAIN_SYSTEM = `You are a senior analyst reviewing a requirement set for what nobody in the room thought to raise.

You are given the requirements extracted from a discovery conversation. The conversation covered what the participants happened to discuss. Systems of a given kind reliably need things that never come up until someone is burned by them.

First, identify what kind of system this is, plainly ("an internal invoice approval workflow").

Then list what a system of that kind normally needs which this requirement set does not address at all. Typical territory — judge which apply, do not walk the list mechanically:
- who is permitted to do what, and who administers that
- what happens when the normal path fails: errors, timeouts, retries, partial failure
- what happens to data over time: retention, deletion, archival, correction of mistakes
- notifications: who is told what, through what channel, and can they turn it off
- concurrency: two people acting on the same thing at once
- migration: what happens to work already in flight when this launches
- reporting and visibility for people outside the immediate flow
- accessibility and language
- what happens when someone leaves the organisation

Rules:
- Only raise something the requirements genuinely do not address. Check the list before flagging.
- These are QUESTIONS TO ASK, not requirements. Write each as something to put to a person.
- severity: high if launching without a decision causes real harm, low if it can wait.
- Do not pad. Three sharp questions beat ten generic ones. An empty list is a valid answer for a genuinely thorough set.`;

export type DomainGap = z.infer<typeof DomainSchema>["gaps"][number];

export type DomainResult = { domain: string; gaps: DomainGap[] };

export async function findDomainGaps(
  requirements: ExtractedRequirement[],
): Promise<DomainResult> {
  if (requirements.length === 0) return { domain: "", gaps: [] };

  const summary = requirements
    .map((r) => `- ${r.title}: ${r.description}`)
    .join("\n");

  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: DOMAIN_SYSTEM,
    messages: [{ role: "user", content: `Requirements:\n\n${summary}` }],
    output_config: { format: zodOutputFormat(DomainSchema) },
  });

  return response.parsed_output ?? { domain: "", gaps: [] };
}
