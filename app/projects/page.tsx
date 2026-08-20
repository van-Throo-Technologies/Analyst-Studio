import Link from "next/link";
import { listProjectsForUser } from "@/lib/db/queries";
import { getCurrentUser } from "@/lib/auth/current-user";
import { formatRelative, pluralize } from "@/lib/utils";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import {
  ModeBadge,
  ProjectStatusBadge,
  RoleBadge,
  ScenarioBadge,
} from "@/components/ui/badges";

export const metadata = { title: "Projects" };

// Project list reflects writes made moments ago, so never serve it from cache.
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-8">
        <PageHeader title="Projects" />
        <EmptyState
          title="No users exist yet"
          description="Analyst Studio needs at least one user before projects can be created. Run `npm run db:seed:users` to create the development users."
        />
      </main>
    );
  }

  // Membership-filtered: a project the acting user has no ProjectAccess row for
  // does not appear here at all.
  const projects = await listProjectsForUser(user.id);

  return (
    <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-8">
      <PageHeader
        title="Projects"
        description={`Projects ${user.name} has access to. Each holds its own discovery sources, requirement model and generated packs.`}
        actions={
          <ButtonLink href="/projects/new" variant="primary">
            New project
          </ButtonLink>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="You do not have access to any projects. Create one — you will be its owner — or ask an owner to add you to theirs."
          action={
            <ButtonLink href="/projects/new" variant="primary">
              Create your first project
            </ButtonLink>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-muted"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-ink">
                        {project.name}
                      </span>
                      <ModeBadge mode={project.defaultMode} />
                      <ProjectStatusBadge status={project.status} />
                      <ScenarioBadge scenario={project.scenarioType} />
                      <RoleBadge role={project.role} />
                    </div>
                    {project.description ? (
                      <p className="mt-1 line-clamp-1 text-sm text-ink-muted">
                        {project.description}
                      </p>
                    ) : null}
                    {project.sourceCount > 0 ? (
                      <p className="mt-1 text-xs text-ink-faint">
                        {project.validatedSourceCount}/{project.sourceCount} sources
                        validated
                        {project.pendingSourceCount > 0 ? (
                          <span className="text-warning">
                            {" · "}
                            {project.pendingSourceCount} awaiting validation
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                  </div>

                  <dl className="hidden shrink-0 gap-6 text-right sm:flex">
                    <Stat label="Sources" value={project.sourceCount} />
                    <Stat label="Requirements" value={project.requirementCount} />
                    <Stat label="Packs" value={project.packCount} />
                    <Stat label="People" value={project.memberCount} />
                  </dl>

                  <div className="w-32 shrink-0 text-right text-xs text-ink-faint">
                    {formatRelative(project.updatedAt)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {projects.length > 0 ? (
        <p className="mt-3 text-xs text-ink-faint">
          {pluralize(projects.length, "project")}
        </p>
      ) : null}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="text-sm tabular-nums text-ink-soft">{value}</dd>
    </div>
  );
}
