import type { ProjectMember } from "@/lib/schemas/entities";
import { PROJECT_ROLE_HINTS, PROJECT_ROLE_LABELS } from "@/lib/schemas/enums";
import { cn } from "@/lib/utils";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui";

/**
 * Who has access to this project, ordered by role.
 *
 * Read-only for now: there is no UI for granting or revoking access, because
 * without authentication an "add member" control would be handing out access on
 * behalf of people who cannot consent to it. The data model and audit actions
 * for it exist; the screen waits for auth.
 * TODO(roadmap): access management UI once auth lands.
 */
export function TeamCard({
  members,
  currentUserId,
  ownerId,
}: {
  members: ProjectMember[];
  currentUserId: string | null;
  ownerId: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team</CardTitle>
        <span className="text-xs text-ink-faint">
          {members.length} {members.length === 1 ? "person" : "people"}
        </span>
      </CardHeader>

      {members.length === 0 ? (
        <CardBody>
          <p className="text-sm text-warning">
            Nobody has access to this project, which should not be possible —
            run <code className="font-mono text-xs">npm run db:seed:users</code>.
          </p>
        </CardBody>
      ) : (
        <ul className="divide-y divide-line">
          {members.map((member) => {
            const isYou = member.userId === currentUserId;
            return (
              <li
                key={member.id}
                className={cn(
                  "flex items-baseline justify-between gap-3 px-5 py-2",
                  isYou && "bg-accent-soft/40",
                )}
              >
                <span className="min-w-0 text-sm text-ink">
                  {member.user.name}
                  {isYou ? (
                    <span className="ml-1.5 text-[11px] text-accent">you</span>
                  ) : null}
                  {member.userId === ownerId ? (
                    <span className="ml-1.5 text-[11px] text-ink-faint">creator</span>
                  ) : null}
                </span>
                <span
                  className="shrink-0 text-xs text-ink-muted"
                  title={PROJECT_ROLE_HINTS[member.role]}
                >
                  {PROJECT_ROLE_LABELS[member.role]}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <CardBody className="border-t border-line pt-3">
        <p className="text-xs text-ink-faint">
          Roles are per project. Access is granted in the database until
          authentication lands.
        </p>
      </CardBody>
    </Card>
  );
}
