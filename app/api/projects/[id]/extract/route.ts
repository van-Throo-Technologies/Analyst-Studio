import Anthropic from "@anthropic-ai/sdk";

import { prisma } from "../../../../../lib/prisma";
import { verifySession } from "../../../../../lib/dal";
import {
  extractRequirements,
  saveExtraction,
  ExtractionError,
} from "../../../../../lib/extract";

// Extraction runs for about a minute. A server action can only resolve once, so
// it cannot say anything while it works; this route streams progress events
// instead and the button reports them as they arrive.
export const maxDuration = 300;

type Event =
  | { type: "started"; documents: number }
  | { type: "progress"; found: number }
  | { type: "done"; count: number }
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

        const extracted = await extractRequirements(
          project.sourceDocuments,
          (found) => send({ type: "progress", found }),
        );

        if (extracted.length === 0) {
          send({ type: "error", message: "No requirements were found in this material." });
        } else {
          // Saved before the done event, so a client that reloads the moment it
          // arrives always sees the requirements it was told about.
          await saveExtraction(project.id, extracted);
          send({ type: "done", count: extracted.length });
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
