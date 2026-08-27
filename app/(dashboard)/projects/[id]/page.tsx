import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getProject } from "../../../../lib/projects";
import { INDUSTRY_LABELS } from "../../../../lib/constants";
import { generateBAPack, generateFAPack } from "../../../../lib/pack-generator";
import { runAllChecks } from "../../../../lib/quality-checker";
import { DocumentUploadArea } from "../../../../components/DocumentUploadArea";
import { ExtractionButton } from "../../../../components/ExtractionButton";
import { RequirementsList } from "../../../../components/RequirementsList";
import { DeleteProjectButton } from "../../../../components/DeleteProjectButton";
import { ProjectTabs } from "../../../../components/ProjectTabs";
import { PackViewer } from "../../../../components/packs/PackViewer";
import { QualityButton } from "../../../../components/quality/QualityButton";
import { QualityReport } from "../../../../components/quality/QualityReport";
import { TraceView } from "../../../../components/trace/TraceView";
import { GapsPanel } from "../../../../components/gaps/GapsPanel";
import styles from "./project.module.css";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(id);
  return { title: project ? `${project.name} — Analyst Studio` : "Analyst Studio" };
}

function lines(value: string | null) {
  if (!value) return [];
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

// A requirement written before traceability existed, or edited by hand, may have
// no stored source. Returning an empty list is honest — better than implying it
// came from everything.
function parseSourceIds(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export default async function ProjectPage({ params }: Params) {
  const { id } = await params;

  // getProject() scopes to the session's own user id and returns null both when
  // the project does not exist and when it belongs to someone else, so a wrong
  // guess at an id is indistinguishable from a real 404.
  const project = await getProject(id);
  if (!project) notFound();

  // Packs and checks are pure derivations of the requirements already loaded, so
  // they are computed here rather than fetched — the tabs switch instantly and
  // no view can be stale relative to another.
  const [ba, fa] = await Promise.all([generateBAPack(id), generateFAPack(id)]);
  const quality = runAllChecks(project.requirements);

  const editedCount = project.requirements.filter((r) => r.isEdited).length;
  const groundedCount = project.requirements.filter((r) => r.isGrounded).length;
  const total = project.requirements.length;

  const filenameById = new Map(
    project.sourceDocuments.map((doc) => [doc.id, doc.filename]),
  );

  const traceRequirements = project.requirements.map((requirement) => {
    const sourceDocumentIds = parseSourceIds(requirement.sourceDocumentIds);
    return {
      id: requirement.id,
      title: requirement.title,
      type: requirement.type,
      priority: requirement.priority,
      sourceDocumentIds,
      sourceFilenames: sourceDocumentIds
        .map((docId) => filenameById.get(docId))
        .filter((name): name is string => Boolean(name)),
      criteria: [...lines(requirement.bdDAC), ...lines(requirement.checklistAC)],
    };
  });

  const traceDocuments = project.sourceDocuments.map((doc) => {
    const count = traceRequirements.filter((r) =>
      r.sourceDocumentIds.includes(doc.id),
    ).length;
    return {
      id: doc.id,
      filename: doc.filename,
      uploadedAt: doc.uploadedAt,
      requirementCount: count,
      share: total === 0 ? 0 : Math.round((count / total) * 100),
    };
  });

  return (
    <main className={styles.main}>
      <Link href="/projects" className={styles.back}>
        ← Projects
      </Link>

      <div className={styles.titleRow}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{project.name}</h1>

          {/* Falls back to the raw slug rather than rendering nothing, so an
              industry added to the database before its label is still legible. */}
          <p className={styles.industry}>
            {INDUSTRY_LABELS[project.industry] ?? project.industry}
          </p>

          <p className={styles.lede}>
            {project.sourceDocuments.length} document
            {project.sourceDocuments.length === 1 ? "" : "s"} · {total} requirement
            {total === 1 ? "" : "s"}
            {total > 0 && (
              <>
                {" · "}
                <span title="Requirements whose supporting quotes were found in the source by literal match">
                  {groundedCount}/{total} evidence-backed
                </span>
              </>
            )}
            {project.coverageScore !== null && ` · ${project.coverageScore}% coverage`}
          </p>
        </div>

        <div className={styles.actions}>
          <QualityButton report={quality} />
          <ExtractionButton
            projectId={project.id}
            documentCount={project.sourceDocuments.length}
            hasRequirements={total > 0}
            editedCount={editedCount}
          />
        </div>
      </div>

      <ProjectTabs
        tabs={[
          {
            id: "requirements",
            label: "Requirements",
            badge: total,
            content: (
              <div className={styles.stack}>
                <DocumentUploadArea
                  projectId={project.id}
                  documents={project.sourceDocuments}
                />
                <RequirementsList
                  requirements={project.requirements}
                  projectId={project.id}
                />
              </div>
            ),
          },
          {
            id: "packs",
            label: "Analyst packs",
            content:
              ba && fa ? (
                <PackViewer
                  projectId={project.id}
                  ba={ba}
                  fa={fa}
                  qualityScore={quality.score}
                />
              ) : null,
          },
          {
            id: "quality",
            label: "Quality",
            badge: quality.issues.length,
            content: <QualityReport report={quality} />,
          },
          {
            id: "gaps",
            label: "Gaps",
            badge: project.findings.length,
            content: (
              <GapsPanel
                findings={project.findings}
                coverageScore={project.coverageScore}
                hasRequirements={total > 0}
              />
            ),
          },
          {
            id: "trace",
            label: "Trace",
            content: (
              <TraceView
                documents={traceDocuments}
                requirements={traceRequirements}
              />
            ),
          },
        ]}
      />

      <footer className={styles.footer}>
        <DeleteProjectButton projectId={project.id} projectName={project.name} />
      </footer>
    </main>
  );
}
