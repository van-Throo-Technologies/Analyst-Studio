import { signOutAction } from "@/app/account-actions";
import { isAuthConfigured } from "@/auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { displayName } from "@/lib/auth/display-name";

/**
 * Who you are signed in as, and the way out.
 *
 * Renders nothing when no provider is configured — the development switcher is
 * showing instead, and two identity controls in one header would be a lie about
 * which one is in charge. The pair is mutually exclusive by construction rather
 * than by a flag: this checks `isAuthConfigured()`, and the switcher's user list
 * comes back empty in exactly the opposite case.
 */
export async function AccountMenu() {
  if (!isAuthConfigured()) return null;

  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="flex items-center gap-2">
      <span
        className="max-w-[16ch] truncate text-xs text-ink-soft"
        title={user.email}
      >
        {displayName(user)}
      </span>
      <form action={signOutAction}>
        <button
          type="submit"
          className="h-7 rounded-md border border-line-strong px-2 text-xs text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
