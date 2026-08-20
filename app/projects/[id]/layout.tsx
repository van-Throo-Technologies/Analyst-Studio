import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { toProject } from "@/lib/db/mappers";
import {
  IndustryBadge,
  ModeBadge,
  ProjectStatusBadge,
  RegulatorySensitivityBadge,
  RoleBadge,
  ScenarioBadge,
} from "@/components/ui/badges";
import { ProjectNav, type NavItem } from "@/components/layout/project-nav";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkProjectAccess, capabilitiesOf } from "@/lib/auth/access";
import { SHOW_PHASE_3_PLUS_NAV } from "@/lib/phase-scope";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: project?.name ?? "Project" };
}

export default async function ProjectLayout({
  children,
  params,
}: LayoutProps<"/projects/[id]">) {
  const { id } = await params;

  const row = await prisma.project.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          sourceDocuments: true,
          extractedInsights: true,
          requirements: true,
          packOutputs: true,
          aiFindings: true,
        },
      },
    },
  });

  if (!row) notFound();

  // Read access is gated here so every screen under this layout inherits it.
  // A non-member gets the same 404 as a non-existent project: telling them a
  // project exists but is not theirs leaks more than it helps.
  const user = await getCurrentUser();
  const access = user ? await checkProjectAccess(id, user.id) : null;
  if (!access) notFound();

  const project = toProject(row);
  const readOnly = !capabilitiesOf(access.role).includes("manage_sources");

  const pendingInsights = await prisma.extractedInsight.count({
    where: { projectId: id, status: "pending" },
  });
  const openFindings = await prisma.aiFinding.count({
    where: { projectId: id, status: "open" },
  });

  const items: NavItem[] = [
    { segment: "", label: "Overview" },
    { segment: "sources", label: "Sources", count: row._count.sourceDocuments },
    ...(SHOW_PHASE_3_PLUS_NAV
      ? [
          {
            segment: "extraction",
            label: "Extraction",
            count: pendingInsights,
            badge: pendingInsights > 0 ? ("attention" as const) : null,
          },
          {
            segment: "requirements",
            label: "Requirement model",
            count: row._count.requirements,
          },
          { segment: "packs", label: "Packs", count: row._count.packOutputs },
          {
            segment: "quality",
            label: "Quality & trace",
            badge: openFindings > 0 ? ("attention" as const) : null,
          },
          { segment: "export", label: "Export" },
        ]
      : []),
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 gap-8 px-6 py-8">
      <aside className="print-hidden sticky top-20 hidden h-fit w-56 shrink-0 lg:block">
        <div className="mb-4">
          <Link
            href="/projects"
            className="text-xs text-ink-faint transition-colors hover:text-ink-soft"
          >
            ← All projects
          </Link>
          <h2 className="mt-2 text-sm font-semibold leading-snug text-ink">
            {project.name}
          </h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <ModeBadge mode={project.defaultMode} />
            <ProjectStatusBadge status={project.status} />
            <IndustryBadge industry={project.industry} />
            <RegulatorySensitivityBadge
              sensitivity={project.regulatorySensitivity}
            />
            <ScenarioBadge scenario={project.scenarioType} />
            <RoleBadge role={access.role} />
          </div>
          {readOnly ? (
            <p className="mt-2 text-[11px] leading-snug text-warning">
              You have read-only access to this project.
            </p>
          ) : null}
        </div>

        <ProjectNav projectId={project.id} items={items} />

        <Link
          href={`/projects/${project.id}/settings`}
          className="mt-3 block rounded-md px-2.5 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
        >
          Settings
        </Link>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
