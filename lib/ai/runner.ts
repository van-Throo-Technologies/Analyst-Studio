import "server-only";
import type { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { prisma } from "@/lib/db/client";
import {
  AI_MODEL,
  AiJobError,
  AiNotConfiguredError,
  anthropic,
  type AiEffort,
} from "@/lib/ai/client";
import type { PromptDefinition, PromptContext } from "@/lib/prompts";
import { analystPersona, projectFraming } from "@/lib/prompts";
import type { AiJob } from "@/lib/schemas/enums";

/**
 * The single entry point for calling the model.
 *
 * Its real job is bookkeeping. Every call — success, refusal or parse failure —
 * writes an AiGeneration row holding the model, prompt id and version, the
 * input entity ids, the verbatim raw output and the normalized output. The raw
 * output is never overwritten and never deleted, because "why did the model say
 * that?" is a question this product has to be able to answer.
 */

export type JobRun<TOutput> = {
  data: TOutput;
  generationId: string;
};

export async function runStructuredJob<TInput, TOutput>(options: {
  projectId: string;
  job: AiJob;
  prompt: PromptDefinition<TInput>;
  context: PromptContext;
  input: TInput;
  schema: z.ZodType<TOutput>;
  /** Ids of the entities fed into this prompt, for the trace record. */
  inputEntityIds: string[];
  effort: AiEffort;
  maxTokens?: number;
}): Promise<JobRun<TOutput>> {
  const {
    projectId,
    job,
    prompt,
    context,
    input,
    schema,
    inputEntityIds,
    effort,
    maxTokens = 16000,
  } = options;

  const system = [
    analystPersona(),
    "",
    projectFraming(context),
    "",
    prompt.system(context),
  ].join("\n");

  const userContent = prompt.user(input);
  const startedAt = Date.now();

  const baseLog = {
    projectId,
    job,
    model: AI_MODEL,
    promptId: prompt.id,
    promptVersion: prompt.version,
    inputEntityIdsJson: JSON.stringify(inputEntityIds),
  };

  let response;
  try {
    response = await anthropic().messages.parse({
      model: AI_MODEL,
      max_tokens: maxTokens,
      // Adaptive thinking is the default on this model; naming it keeps the
      // intent explicit for anyone reading the call site.
      thinking: { type: "adaptive" },
      output_config: {
        effort,
        format: zodOutputFormat(schema),
      },
      system: [
        {
          type: "text",
          text: system,
          // The persona and project framing are identical across every job for
          // a project, so caching them makes repeated runs materially cheaper.
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userContent }],
    });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) throw error;

    const message = error instanceof Error ? error.message : String(error);
    const generation = await prisma.aiGeneration.create({
      data: {
        ...baseLog,
        rawOutput: "",
        outcome: "api_error",
        errorMessage: message,
        durationMs: Date.now() - startedAt,
      },
    });
    throw new AiJobError(
      `The model could not be reached: ${message}`,
      generation.id,
      "api_error",
    );
  }

  const durationMs = Date.now() - startedAt;
  const rawOutput = JSON.stringify(response.content);

  if (response.stop_reason === "refusal") {
    const generation = await prisma.aiGeneration.create({
      data: {
        ...baseLog,
        rawOutput,
        outcome: "api_error",
        errorMessage: `Refused: ${response.stop_details?.category ?? "unspecified"}`,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        durationMs,
      },
    });
    throw new AiJobError(
      "The model declined this request. Review the source material for content that may have triggered a safety classifier.",
      generation.id,
      "refusal",
    );
  }

  const parsed = response.parsed_output;
  if (parsed == null) {
    const generation = await prisma.aiGeneration.create({
      data: {
        ...baseLog,
        rawOutput,
        outcome: "parse_error",
        errorMessage:
          response.stop_reason === "max_tokens"
            ? "Output hit the token limit before the structure was complete."
            : "Output did not match the expected schema.",
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        durationMs,
      },
    });
    throw new AiJobError(
      response.stop_reason === "max_tokens"
        ? "The response was cut off before it was complete. Try running against fewer sources at once."
        : "The response did not match the expected structure. The raw output has been kept for review.",
      generation.id,
      "parse_error",
    );
  }

  const generation = await prisma.aiGeneration.create({
    data: {
      ...baseLog,
      rawOutput,
      normalizedOutput: JSON.stringify(parsed),
      outcome: "ok",
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
    },
  });

  return { data: parsed, generationId: generation.id };
}

/**
 * Marks a generation as having been edited by a human afterwards. Called from
 * the entity update actions — the distinction between "as generated" and "as
 * reviewed" is the whole point of keeping the log.
 */
export async function markGenerationEdited(generationId: string): Promise<void> {
  await prisma.aiGeneration.updateMany({
    where: { id: generationId },
    data: { userEditedAfter: true },
  });
}
