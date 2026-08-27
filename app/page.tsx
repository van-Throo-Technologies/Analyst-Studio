import { verifySession } from "../lib/dal";
import { signOut } from "../lib/auth";
import styles from "./page.module.css";

export default async function Home() {
  // Guards this page. Unauthenticated visitors are redirected to /signin before
  // anything below runs, so nothing here can leak to a signed-out request.
  const { email } = await verifySession();

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <span className={styles.user}>{email}</span>
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
      </header>

      <h1>Analyst Studio</h1>
      <p>Phase 1 MVP - Requirements Extraction Tool</p>
    </main>
  );
}
