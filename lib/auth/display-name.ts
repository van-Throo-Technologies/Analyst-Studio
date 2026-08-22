/**
 * How a person is named in the interface.
 *
 * `User.name` is nullable because the Auth.js adapter requires it to be: a
 * magic-link sign-in carries no name at all, and an OAuth profile may withhold
 * one. That nullability must not reach a template — "Validated by null" is a
 * bug the reader sees. Every place that prints a person goes through here.
 *
 * The fallback is the local part of the email rather than a placeholder like
 * "Unknown user", because it still identifies who acted. Audit trails and
 * validation records are the main callers, and there attribution is the whole
 * point of the line.
 *
 * Deliberately not `server-only` — the team card and the user switcher are
 * client components and need it too.
 */

type NameableUser = { name: string | null; email: string };

export function displayName(user: NameableUser): string {
  const trimmed = user.name?.trim();
  if (trimmed) return trimmed;

  const localPart = user.email.split("@")[0]?.trim();
  return localPart || user.email;
}

/**
 * For rows where the person may be gone entirely — a source outlives the
 * deletion of whoever validated it, so the relation is nullable on top of the
 * name being nullable.
 *
 * `absent` is passed in rather than defaulted because the honest phrasing
 * differs by context: a deleted uploader is "a former member", a deleted
 * validator reads better as "someone no longer on this project".
 */
export function displayNameOr(
  user: NameableUser | null | undefined,
  absent: string,
): string {
  return user ? displayName(user) : absent;
}
