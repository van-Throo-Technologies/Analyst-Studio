import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth, isAuthConfigured } from "@/auth";
import { prisma } from "@/lib/db/client";
import type { User } from "@/lib/schemas/entities";

/**
 * ============================================================================
 * THE ONLY PLACE THAT RESOLVES IDENTITY
 * ============================================================================
 *
 * Access checks, audit attribution and source uploader tracking all go through
 * `getCurrentUser()`. Nothing else reads a session or a cookie.
 *
 * There are two paths, and which one is live depends on configuration rather
 * than on a flag someone has to remember to flip:
 *
 *   1. A real Auth.js session, whenever any provider is configured.
 *   2. The development user switcher, only when none is.
 *
 * The second path exists because the seeded cast is how per-project access
 * control is actually exercised — switching to Rachel Osei (REVIEWER) must make
 * every edit control refuse, and Nadia Haddad must see nothing at all. Deleting
 * it the moment Auth.js landed would mean nobody could test authorisation until
 * a Google OAuth app existed, which is the wrong order to do the work in.
 *
 * It is fenced twice. `isAuthConfigured()` must be false, *and* NODE_ENV must
 * not be production. Both conditions failing closed means a production deploy
 * that is missing its credentials shows nobody rather than showing everybody
 * the first seeded user — the failure mode worth engineering against here is
 * not "login is broken", it is "login is broken and everyone is Janine".
 */

const DEV_USER_COOKIE = "as_dev_user";

/** Whether the development switcher is permitted to resolve a user at all. */
export function devSwitcherEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && !isAuthConfigured();
}

export async function getCurrentUser(): Promise<User | null> {
  if (isAuthConfigured()) {
    const session = await auth();
    const id = session?.user?.id;
    if (!id) return null;

    // The session carries a snapshot; the row is the truth. Reading it means a
    // rename or a deletion takes effect on the next request rather than
    // whenever the session happens to be refreshed.
    return prisma.user.findUnique({ where: { id } });
  }

  if (!devSwitcherEnabled()) return null;

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
 * For code paths that cannot proceed without a user.
 *
 * Redirects to sign-in when auth is live, and throws only in the development
 * case, where there is no sign-in page to send anyone to and an empty user
 * table is a setup mistake worth saying out loud.
 */
export async function requireCurrentUser(): Promise<User> {
  const user = await getCurrentUser();
  if (user) return user;

  if (isAuthConfigured()) redirect("/login");

  throw new Error(
    "No users exist. Run `npm run db:seed:users` to create the development users.",
  );
}

/**
 * Dev-only: everyone who can be acted as.
 *
 * Returns nothing once auth is configured, so the switcher in the header
 * disappears on its own rather than needing to be torn out.
 */
export async function listSelectableUsers(): Promise<User[]> {
  if (!devSwitcherEnabled()) return [];
  return prisma.user.findMany({ orderBy: { createdAt: "asc" } });
}

/** Dev-only: switch the acting user. A no-op once auth is configured. */
export async function setDevUser(userId: string): Promise<void> {
  if (!devSwitcherEnabled()) return;

  const store = await cookies();
  store.set(DEV_USER_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
