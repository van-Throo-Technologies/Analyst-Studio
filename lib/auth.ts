import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),

  // Without this, Auth.js serves its own built-in sign-in page and sends error
  // redirects there instead of to app/signin.
  pages: { signIn: "/signin" },

  // Email sign-in issues a one-time token that must be looked up when the link
  // is opened, so the session has to live in the database — a JWT strategy
  // cannot verify it. This is the adapter's default; stated here so that
  // switching it later is a deliberate act rather than an accident.
  session: { strategy: "database" },

  providers: [
    Resend({
      // Auth.js infers a provider's key from AUTH_<ID>_KEY — AUTH_RESEND_KEY
      // here — and this project stores it as RESEND_API_KEY, so it is passed
      // through explicitly rather than renaming the variable.
      apiKey: process.env.RESEND_API_KEY,

      // Must be an address on a domain verified in Resend, or delivery fails.
      // onboarding@resend.dev is Resend's sandbox sender: it works without a
      // verified domain but only delivers to your own account address.
      from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
    }),
  ],
});
