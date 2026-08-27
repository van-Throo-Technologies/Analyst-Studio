import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getProject } from "../../../../lib/projects";
import { DocumentUploadArea } from "../../../../components/DocumentUploadArea";
import { ExtractionButton } from "../../../../components/ExtractionButton";
import { RequirementsList } from "../../../../components/RequirementsList";
import { DeleteProjectButton } from "../../../../components/DeleteProjectButton";
import styles from "./project.module.css";

// Extraction reads whole transcripts and routinely runs about a minute. Server
// actions execute in this page's function, so the ceiling has to cover them —
// Vercel's default is 300s and the platform maximum on Fluid Compute is higher,
// but 300 is ample for a single extraction pass.
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(id);
  return { title: project ? `${project.name} — Analyst Studio` : "Analyst Studio" };
}

export default async function ProjectPage({ params }: Params) {
  const { id } = await params;

  // getProject() scopes to the session's own user id and returns null both when
  // the project does not exist and when it belongs to someone else, so a wrong
  // guess at an id is indistinguishable from a real 404.
  const project = await getProject(id);
  if (!project) notFound();

  return (
    <main className={styles.main}>
      <Link href="/projects" className={styles.back}>
        ← Projects
      </Link>

      <div className={styles.titleRow}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{project.name}</h1>
          <p className={styles.lede}>
            {project.sourceDocuments.length} document
            {project.sourceDocuments.length === 1 ? "" : "s"} ·{" "}
            {project.requirements.length} requirement
            {project.requirements.length === 1 ? "" : "s"}
          </p>
        </div>

        <ExtractionButton
          projectId={project.id}
          documentCount={project.sourceDocuments.length}
          hasRequirements={project.requirements.length > 0}
        />
      </div>

      <div className={styles.stack}>
        <DocumentUploadArea
          projectId={project.id}
          documents={project.sourceDocuments}
        />

        <RequirementsList requirements={project.requirements} />
      </div>

      <footer className={styles.footer}>
        <DeleteProjectButton projectId={project.id} projectName={project.name} />
      </footer>
    </main>
  );
}
