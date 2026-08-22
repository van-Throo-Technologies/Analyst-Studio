import { switchDevUserAction } from "@/app/dev-user-actions";
import { getCurrentUser, listSelectableUsers } from "@/lib/auth/current-user";
import { displayName } from "@/lib/auth/display-name";

/**
 * ============================================================================
 * DEVELOPMENT ONLY — DELETE WHEN REAL AUTH LANDS
 * ============================================================================
 *
 * Switches the acting user. This exists because per-project access control
 * cannot be reviewed, demonstrated or trusted if there is only ever one user:
 * "non-members can't edit" is not a claim you can check from a single session.
 *
 * It is not a login. It sets a cookie that lib/auth/current-user.ts reads, and
 * it is deliberately labelled so nobody mistakes it for a security boundary.
 * Remove this component, its action, and the dev helpers in current-user.ts
 * together.
 */
export async function DevUserSwitcher() {
  const [user, users] = await Promise.all([
    getCurrentUser(),
    listSelectableUsers(),
  ]);

  if (!user || users.length === 0) return null;

  return (
    <form action={switchDevUserAction} className="flex items-center gap-1.5">
      <span
        className="rounded border border-warning-line bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warning"
        title="There is no authentication yet. This switches who the app treats you as, so per-project access can be exercised."
      >
        No auth
      </span>
      <label htmlFor="dev-user" className="sr-only">
        Acting as
      </label>
      <select
        id="dev-user"
        name="userId"
        defaultValue={user.id}
        // Submitting on change keeps this to one control; it is a dev affordance,
        // not a form worth an explicit save button.
        className="h-7 cursor-pointer rounded-md border border-line-strong bg-surface px-2 text-xs text-ink-soft transition-colors hover:border-ink-faint"
      >
        {users.map((option) => (
          <option key={option.id} value={option.id}>
            {displayName(option)}
          </option>
        ))}
      </select>
      <noscript>
        <button
          type="submit"
          className="h-7 rounded-md border border-line-strong px-2 text-xs"
        >
          Switch
        </button>
      </noscript>
      <SubmitOnChange />
    </form>
  );
}

/** Tiny client island so the select submits itself. */
function SubmitOnChange() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `document.getElementById('dev-user')?.addEventListener('change',function(){this.form.requestSubmit()})`,
      }}
    />
  );
}
