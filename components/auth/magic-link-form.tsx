"use client";

import { useActionState } from "react";
import { sendMagicLinkAction } from "@/app/login/actions";
import type { FormState } from "@/lib/forms";
import { Field, FormError, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * Email sign-in. Sends a one-time link rather than asking for a password —
 * there is no password column anywhere in this app, and adding one to support a
 * form like this would be the wrong trade.
 */
export function MagicLinkForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(
    sendMagicLinkAction,
    null,
  );

  const sent = state?.ok === true;

  if (sent) {
    return (
      <p className="rounded-md border border-line bg-canvas px-3 py-2.5 text-sm text-ink-soft">
        Link sent. Open it on this device — it signs you in and expires in 24
        hours.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <FormError message={state?.ok === false ? state.message : null} />
      <Field
        label="Email"
        htmlFor="email"
        required
        error={state?.ok === false ? state.fieldErrors?.email : undefined}
        hint="We send a link. There is no password to remember."
      >
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </Field>
      <SubmitButton pendingLabel="Sending…" className="w-full">
        Email me a link
      </SubmitButton>
    </form>
  );
}
