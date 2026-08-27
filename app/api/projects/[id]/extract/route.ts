import Anthropic from "@anthropic-ai/sdk";

import { prisma } from "../../../../../lib/prisma";
import { verifySession } from "../../../../../lib/dal";
import {
  runPipeline,
  savePipelineResult,
  ExtractionError,
  type PipelineStage,
} from "../../../../../lib/extract";

// The pipeline runs several model passes and takes minutes rather than seconds.
// A server action can only resolve once, so it could not report any of that;
// this route streams each stage as it starts.
//
// 300s is the ceiling available on every plan — higher needs Pro with Fluid
// Compute. A measured single-document run takes about 190s, so there is
// headroom but not unlimited headroom: a very large document set can still hit
// this, and the stream will end without a done event.
export const maxDuration = 300;

type Event =
  | { type: "started"; documents: number }
  | { type: "stage"; stage: PipelineStage; label: string }
  | { type: "progress"; found: number }
  | {
      type: "done";
      count: number;
      grounded: number;
      coverageScore: number;
      gaps: number;
      repaired: number;
    }
  | { type: "error"; message: string };

function sse(event: Event) {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // A route handler is a public endpoint like any other — it re-derives the
  // user from the session rather than trusting the caller.
  const { userId } = await verifySession();
  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, userId },
    include: { sourceDocuments: { select: { filename: true, content: true } } },
  });

  if (!project) {
    return Response.json({ error: "That project could not be found." }, { status: 404 });
  }
  if (project.sourceDocuments.length === 0) {
    return Response.json(
      { error: "Add source material before running extraction." },
      { status: 400 },
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      // The client may navigate away mid-run. Writing to a closed controller
      // throws, so every enqueue goes through this guard.
      let open = true;
      const send = (event: Event) => {
        if (!open) return;
        try {
          controller.enqueue(sse(event));
        } catch {
          open = false;
        }
      };

      try {
        send({ type: "started", documents: project.sourceDocuments.length });

        const result = await runPipeline(project.sourceDocuments, (event) => {
          if (event.type === "stage") {
            send({ type: "stage", stage: event.stage, label: event.label });
          } else {
            send({ type: "progress", found: event.found });
          }
        });

        if (result.requirements.length === 0) {
          send({ type: "error", message: "No requirements were found in this material." });
        } else {
          // Saved before the done event, so a client that reloads the moment it
          // arrives always sees the requirements it was told about.
          await savePipelineResult(project.id, result);

          const grounded = [...result.grounding.values()].filter((g) => g.isGrounded).length;
          send({
            type: "done",
            count: result.requirements.length,
            grounded,
            coverageScore: result.coverageScore,
            gaps: result.coverageGaps.length + result.domainGaps.length,
            repaired: result.repaired,
          });
        }
      } catch (error) {
        // Typed SDK errors, most specific first — a rate limit and a bad key
        // need different things from the person reading the message.
        let message: string;
        if (error instanceof Anthropic.AuthenticationError) {
          message = "The Anthropic API key is missing or invalid.";
        } else if (error instanceof Anthropic.RateLimitError) {
          message = "Rate limited by the API. Wait a moment and try again.";
        } else if (error instanceof Anthropic.APIError) {
          message = `The extraction service returned an error (${error.status}).`;
        } else if (error instanceof ExtractionError) {
          message = error.message;
        } else {
          message = error instanceof Error ? error.message : "Extraction failed.";
        }
        send({ type: "error", message });
      } finally {
        open = false;
        try {
          controller.close();
        } catch {
          // Already closed by the client disconnecting.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
