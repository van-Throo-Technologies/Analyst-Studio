import { verifySession } from "../lib/dal";
import { getProjects } from "../lib/projects";
import { signOut } from "../lib/auth";
import { Logo } from "./_components/logo";
import styles from "./page.module.css";

// Fixed locale rather than the server's own, so the rendered markup does not
// depend on where it happens to run.
const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function Home() {
  // Guards this page. Unauthenticated visitors are redirected to /signin before
  // anything below runs, so nothing here can leak to a signed-out request.
  const { email } = await verifySession();
  const projects = await getProjects();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Logo muted />
          <span className={styles.divider} aria-hidden="true" />
          <span className={styles.appName}>Analyst Studio</span>
        </div>

        <div className={styles.account}>
          <span className={styles.email}>{email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/signin" });
            }}
          >
            <button type="submit" className={styles.signout}>
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.title}>Projects</h1>
            <p className={styles.lede}>
              Turn messy discovery into structured analysis.
            </p>
          </div>

          {/* Present so the shell reads as finished, disabled because the
              transcript pipeline behind it is not built yet. A button that
              silently does nothing would be worse than one that says so. */}
          <div className={styles.actionWrap}>
            <button type="button" className={styles.primary} disabled>
              + New project
            </button>
            <span className={styles.actionNote}>Arrives with Phase 1</span>
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
              requirements extracted from them. Once transcript upload lands,
              this is where they will live.
            </p>
          </section>
        ) : (
          <ul className={styles.list}>
            {projects.map((project) => (
              <li key={project.id} className={styles.item}>
                <span className={styles.itemName}>{project.name}</span>
                <span className={styles.itemMeta}>
                  Updated {DATE.format(project.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
