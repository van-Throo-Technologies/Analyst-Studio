import Link from "next/link";
import type { ProjectListItem } from "../lib/projects";
import styles from "./ProjectCard.module.css";

const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function ProjectCard({ project }: { project: ProjectListItem }) {
  const docs = project._count.sourceDocuments;
  const reqs = project._count.requirements;

  return (
    <Link href={`/projects/${project.id}`} className={styles.card}>
      <div className={styles.body}>
        <h2 className={styles.name}>{project.name}</h2>
        <p className={styles.meta}>
          {plural(docs, "document")} · {plural(reqs, "requirement")}
        </p>
      </div>

      <div className={styles.side}>
        <span className={styles.date}>Updated {DATE.format(project.updatedAt)}</span>
        <span className={styles.chevron} aria-hidden="true">→</span>
      </div>
    </Link>
  );
}
