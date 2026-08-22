import type { NextRequest } from "next/server";
import { handlers, isAuthConfigured } from "@/auth";

/**
 * The Auth.js callback endpoint. Everything — the OAuth round trip, the magic
 * link redemption, session lookup and sign-out — is served from here.
 *
 * Auth.js v5 hands back both verbs as ready-made App Router handlers. The v4
 * equivalent lived at pages/api/auth/[...nextauth].js and would not be routed
 * at all in this app.
 *
 * The handlers are gated on configuration rather than exported bare. With no
 * provider and no AUTH_SECRET, Auth.js answers every request here with a 500 —
 * technically true, but it reports a server fault for what is really an absent
 * feature. Nothing in the app links here in that state, so 404 is the honest
 * answer: this endpoint does not exist yet.
 */

function notFound() {
  return new Response("Not found", { status: 404 });
}

export async function GET(request: NextRequest) {
  if (!isAuthConfigured()) return notFound();
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  if (!isAuthConfigured()) return notFound();
  return handlers.POST(request);
}
