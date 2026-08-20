import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Every AI job in Analyst Studio goes through this module.
 *
 * One model, one client, one place to change them. Jobs never construct their
 * own client or hard-code a model name — that is what makes the generation log
 * in /lib/ai/runner.ts trustworthy.
 */

export const AI_MODEL = "claude-opus-5";

/** Effort per job. Extraction is broad but shallow; quality review is not. */
export const AI_EFFORT = {
  extraction: "medium",
  drafting: "high",
  review: "high",
  narrative: "high",
} as const;

export type AiEffort = (typeof AI_EFFORT)[keyof typeof AI_EFFORT];

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

let cached: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!isAiConfigured()) {
    throw new AiNotConfiguredError();
  }
  cached ??= new Anthropic({
    // AI jobs read whole source documents and write structured packs; the
    // 10-minute default is generous but a long extraction should not be cut off.
    timeout: 10 * 60 * 1000,
    maxRetries: 2,
  });
  return cached;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is not set. Add it to .env and restart the dev server to enable AI jobs.",
    );
    this.name = "AiNotConfiguredError";
  }
}

/** Thrown when a job ran but produced nothing usable. Always logged first. */
export class AiJobError extends Error {
  constructor(
    message: string,
    readonly generationId: string | null,
    readonly kind: "refusal" | "parse_error" | "api_error",
  ) {
    super(message);
    this.name = "AiJobError";
  }
}
