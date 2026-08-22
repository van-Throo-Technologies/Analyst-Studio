import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { prisma } from "@/lib/db/client";

/**
 * Auth.js (NextAuth v5) configuration — the whole of it, in one file.
 *
 * Two ways in, both landing on the same User row because the adapter links by
 * verified email:
 *   - Google, for anyone who has a Google account;
 *   - a Resend magic link, for anyone who does not.
 *
 * Resend rather than SMTP: the Auth.js provider posts to Resend's HTTP API with
 * plain `fetch`, so magic links cost one environment variable instead of a
 * nodemailer dependency and five SMTP settings.
 *
 * Sessions are database-backed. The Prisma adapter is already here, so the cost
 * is a row, and a row can be deleted — revoking a session server-side is
 * something a signed JWT cannot offer. It matters for an app whose whole access
 * model is per-project roles that an owner may need to withdraw immediately.
 */

/**
 * Whether a provider is configured decides whether it is offered at all.
 *
 * Building the list conditionally rather than unconditionally is what keeps the
 * app usable before the Google credentials exist: an unconfigured provider that
 * is still registered produces a route that fails at request time, and the
 * login page would advertise a button that cannot work. With no provider
 * configured at all, `isAuthConfigured()` is false and lib/auth/current-user.ts
 * falls back to the development user switcher.
 */
const googleClientId = process.env.GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID;
const googleClientSecret =
  process.env.GOOGLE_CLIENT_SECRET ?? process.env.AUTH_GOOGLE_SECRET;
const resendApiKey = process.env.RESEND_API_KEY ?? process.env.AUTH_RESEND_KEY;
const emailFrom = process.env.EMAIL_FROM ?? "no-reply@analyst-studio.app";

export const hasGoogleProvider = Boolean(googleClientId && googleClientSecret);
export const hasEmailProvider = Boolean(resendApiKey);

/**
 * True when at least one way in is configured. Read by current-user.ts to
 * decide whether real sessions are in play, and by the login page to decide
 * what to render.
 *
 * Deliberately a function rather than a const so it is evaluated per call —
 * environment variables can differ between build and runtime.
 */
export function isAuthConfigured(): boolean {
  return hasGoogleProvider || hasEmailProvider;
}

const providers = [
  ...(hasGoogleProvider
    ? [
        Google({
          clientId: googleClientId,
          clientSecret: googleClientSecret,
          // Ask Google to re-offer the account chooser rather than silently
          // reusing whichever account the browser last used. Several people
          // share a machine during the tester phase, and a silent sign-in as
          // the wrong person is an attribution bug in the audit log.
          authorization: { params: { prompt: "select_account" } },
        }),
      ]
    : []),
  ...(hasEmailProvider
    ? [Resend({ apiKey: resendApiKey, from: emailFrom })]
    : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  // The generated client lives at lib/generated/prisma rather than
  // @prisma/client, which is where the adapter's types expect it. The runtime
  // shape is identical — this cast reconciles two spellings of the same client,
  // not two different clients.
  adapter: PrismaAdapter(prisma as never) as Adapter,
  providers,
  session: { strategy: "database" },
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
    error: "/login",
  },
  callbacks: {
    /**
     * The default session carries name/email/image but no id, and every access
     * check in this app is by user id. Adding it here means `auth()` returns
     * everything lib/auth/current-user.ts needs without a second query.
     */
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});
