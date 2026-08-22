import type { Metadata } from "next";
import { ButtonLink, Card, CardBody } from "@/components/ui";

export const metadata: Metadata = { title: "Check your email" };

/**
 * Where Auth.js sends someone after a magic link goes out. Configured as
 * `pages.verifyRequest` in auth.ts.
 */
export default function CheckEmailPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <Card>
        <CardBody className="space-y-3">
          <h1 className="text-base font-semibold tracking-tight text-ink">
            Check your email
          </h1>
          <p className="text-sm text-ink-soft">
            We sent a sign-in link. Open it on this device — it works once and
            expires in 24 hours.
          </p>
          <p className="text-sm text-ink-faint">
            Nothing arrived? Check spam, then request another link.
          </p>
          <ButtonLink href="/login" variant="secondary" size="sm">
            Back to sign in
          </ButtonLink>
        </CardBody>
      </Card>
    </main>
  );
}
