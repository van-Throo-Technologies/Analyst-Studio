import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/client";
import type { User } from "@/lib/schemas/entities";

/**
 * ============================================================================
 * MOCKED AUTHENTICATION — THE ONLY PLACE TO REPLACE WHEN REAL AUTH LANDS
 * ============================================================================
 *
 * There is no authentication in this MVP. `getCurrentUser()` resolves the
 * acting user from a dev-only cookie, falling back to the first user in the
 * database. Everything else in the app — access checks, audit attribution,
 * source uploader tracking — goes through this function and needs no change
 * when it is replaced.
 *
 * To swap in real auth:
 *   1. Replace the body of `getCurrentUser()` with a session lookup.
 *   2. Delete `setDevUser()`, `listSelectableUsers()` and the dev user switcher
 *      component that calls them (components/layout/dev-user-switcher.tsx).
 *   3. Have `requireCurrentUser()` redirect to a sign-in page instead of
 *      throwing.
 *
 * The cookie is not a security boundary and is not pretending to be one. It is
 * a way to act as different people while building, so per-project access
 * control can actually be exercised.
 */

const DEV_USER_COOKIE = "as_dev_user";

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const requestedId = store.get(DEV_USER_COOKIE)?.value;

  if (requestedId) {
    const row = await prisma.user.findUnique({ where: { id: requestedId } });
    if (row) return row;
    // Cookie points at a user who no longer exists — fall through rather than
    // leaving the app unusable.
  }

  // Deterministic fallback so a fresh checkout is immediately usable.
  return prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
}

/**
 * For code paths that cannot proceed without a user. Throws rather than
 * returning null so a caller can never silently act as nobody.
 */
export async function requireCurrentUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error(
      "No users exist. Run `npm run db:seed:users` to create the development users.",
    );
  }
  return user;
}

/** Dev-only: everyone who can be acted as. Delete when real auth lands. */
export async function listSelectableUsers(): Promise<User[]> {
  return prisma.user.findMany({ orderBy: { createdAt: "asc" } });
}

/** Dev-only: switch the acting user. Delete when real auth lands. */
export async function setDevUser(userId: string): Promise<void> {
  const store = await cookies();
  store.set(DEV_USER_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
