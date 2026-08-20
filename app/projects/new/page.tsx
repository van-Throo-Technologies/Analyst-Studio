import { ButtonLink, PageHeader } from "@/components/ui";
import { NewProjectForm } from "@/components/projects/new-project-form";

export const metadata = { title: "New project" };

export default function NewProjectPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <PageHeader
        title="New project"
        description="Set the framing once. Everything the AI extracts and every pack it generates is written against this context."
        actions={<ButtonLink href="/projects">Cancel</ButtonLink>}
      />
      <NewProjectForm />
    </main>
  );
}
