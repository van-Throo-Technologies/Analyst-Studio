import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Sends signed-out visitors to /login before a project page renders.
 *
 * `proxy.ts`, not `middleware.ts`: the middleware file convention is deprecated
 * in Next 16 and renamed to proxy. A middleware.ts here would simply never run.
 *
 * This is a courtesy, not the access boundary — the same relationship the
 * extraction runner's UI check has with the job's own check. It tests only that
 * a session cookie is *present*, never whether it is valid, and it knows
 * nothing about project roles. The real gate is `requireCapability` in
 * lib/auth/access.ts, which runs in the layout and in every mutation with the
 * database in front of it.
 *
 * Deliberately no `auth()` call and no Prisma query. Proxy runs on every
 * matched request, ahead of rendering, and Next's own guidance is that it
 * should not depend on shared modules or reach for a database. Validating the
 * cookie here would put a query in front of every navigation and duplicate a
 * check that the layout already performs correctly.
 *
 * A forged cookie therefore gets past this file and is then refused by the
 * layout — which is the intended division, not a gap.
 */

/** Auth.js v5 cookie names. The `__Secure-` form is used over HTTPS. */
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export function proxy(request: NextRequest) {
  const signedIn = SESSION_COOKIES.some((name) =>
    request.cookies.has(name),
  );
  if (signedIn) return NextResponse.next();

  // No provider configured means the development switcher is resolving the
  // user, and there is no sign-in to send anyone to. Redirecting would strand
  // the app on a login page with no buttons on it.
  const authConfigured = Boolean(
    (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) ||
      process.env.AUTH_GOOGLE_ID ||
      process.env.RESEND_API_KEY ||
      process.env.AUTH_RESEND_KEY,
  );
  if (!authConfigured) return NextResponse.next();

  const target = new URL("/login", request.url);
  // Bring them back where they were aiming once they are through.
  target.searchParams.set(
    "next",
    request.nextUrl.pathname + request.nextUrl.search,
  );
  return NextResponse.redirect(target);
}

export const config = {
  // Only the project surface. /login and /api/auth must stay reachable to
  // signed-out visitors, and matching them would be a redirect loop.
  matcher: ["/projects/:path*"],
};
