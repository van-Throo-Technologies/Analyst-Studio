"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/auth";
import { invalid, text, type FormState } from "@/lib/forms";

const emailSchema = z.object({
  email: z.email("Enter an email address we can send a link to."),
});

/**
 * Sends a magic link.
 *
 * `signIn` redirects by throwing, which is how Next signals a redirect from a
 * server action — so the NEXT_REDIRECT it raises must be allowed to escape.
 * Only a genuine AuthError is turned into a FormState, per the house rule that
 * actions return for user error and throw for faults.
 */
export async function sendMagicLinkAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = emailSchema.safeParse({ email: text(formData, "email") });
  if (!parsed.success) return invalid(parsed.error);

  const next = text(formData, "next") || "/projects";

  try {
    await signIn("resend", { email: parsed.data.email, redirectTo: next });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        message:
          "That link could not be sent. Check the address and try again.",
      };
    }
    throw error;
  }

  return { ok: true, message: "Check your inbox." };
}

/** Starts the Google round trip. Always redirects; never returns normally. */
export async function signInWithGoogleAction(formData: FormData) {
  const next = text(formData, "next") || "/projects";
  await signIn("google", { redirectTo: next });
}
