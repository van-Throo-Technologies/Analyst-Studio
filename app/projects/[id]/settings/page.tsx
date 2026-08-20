import { notFound } from "next/navigation";
import { getProject } from "@/lib/db/queries";
import { PageHeader } from "@/components/ui";
import { ProjectSettingsForm } from "@/components/projects/project-settings-form";

export const dynamic = "force-dynamic";

export default async function ProjectSettingsPage({
  params,
}: PageProps<"/projects/[id]/settings">) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Project framing and status. The analysis goal and domain context are sent with every AI job, so keeping them sharp is the cheapest way to improve output."
      />
      <ProjectSettingsForm project={project} />
    </>
  );
}
