import type { Metadata } from "next";
import { getProjects } from "../../../lib/projects";
import { ProjectCard } from "../../../components/ProjectCard";
import { NewProjectForm } from "../../../components/NewProjectForm";
import styles from "./projects.module.css";

export const metadata: Metadata = { title: "Projects — Analyst Studio" };

export default async function ProjectsPage() {
  // getProjects() calls verifySession() internally, which redirects an
  // unauthenticated request before any data is read.
  const projects = await getProjects();

  return (
    <main className={styles.main}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>Projects</h1>
          <p className={styles.lede}>
            Turn messy discovery into structured analysis.
          </p>
        </div>
        <div className={styles.action}>
          <NewProjectForm />
        </div>
      </div>

      {projects.length === 0 ? (
        <section className={styles.empty}>
          <span className={styles.emptyGlyph} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
              strokeLinejoin="round">
              <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h3.7l2 2.4h7.3A1.5 1.5 0 0 1 20 8.9v8.6a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
            </svg>
          </span>
          <h2 className={styles.emptyTitle}>No projects yet</h2>
          <p className={styles.emptyBody}>
            A project holds one engagement&apos;s transcripts and the
            requirements extracted from them. Name your first one above.
          </p>
        </section>
      ) : (
        <ul className={styles.list}>
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
