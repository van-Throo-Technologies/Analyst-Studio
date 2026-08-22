import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  hasEmailProvider,
  hasGoogleProvider,
  isAuthConfigured,
} from "@/auth";
import { signInWithGoogleAction } from "@/app/login/actions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Card, CardBody, Divider } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { MagicLinkForm } from "@/components/auth/magic-link-form";

export const metadata: Metadata = { title: "Sign in" };

/**
 * Only the ways in that are actually configured are rendered. A button for an
 * unconfigured provider is a button that fails, and during setup it is normal
 * for one of the two to exist before the other.
 */
export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const rawNext = typeof params.next === "string" ? params.next : "/projects";
  // Only same-site paths. An open redirect here would let a sign-in link land
  // someone on another origin carrying the referrer.
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//")
    ? rawNext
    : "/projects";

  if (!isAuthConfigured()) redirect("/projects");

  const user = await getCurrentUser();
  if (user) redirect(next);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <div className="mb-6 space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          Sign in to Analyst Studio
        </h1>
        <p className="text-sm text-ink-soft">
          Projects, sources and packs are private to the people given access to
          them.
        </p>
      </div>

      <Card>
        <CardBody className="space-y-4">
          {hasGoogleProvider ? (
            <form action={signInWithGoogleAction}>
              <input type="hidden" name="next" value={next} />
              <SubmitButton
                variant="secondary"
                pendingLabel="Redirecting…"
                className="w-full"
              >
                Continue with Google
              </SubmitButton>
            </form>
          ) : null}

          {hasGoogleProvider && hasEmailProvider ? <Divider /> : null}

          {hasEmailProvider ? <MagicLinkForm next={next} /> : null}
        </CardBody>
      </Card>

      <p className="mt-4 text-xs text-ink-faint">
        Signing in for the first time creates your account. Someone with access
        to a project still has to add you to it before it appears here.
      </p>
    </main>
  );
}
