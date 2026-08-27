import Link from "next/link";
import { verifySession } from "../../lib/dal";
import { signOut } from "../../lib/auth";
import { Logo } from "../_components/logo";
import styles from "./layout.module.css";

// The shell every signed-in page shares. verifySession() runs here so the header
// can name the account — but it is deliberately NOT the only guard: layouts do
// not re-render on navigation under partial rendering and cannot stop the
// segments below them rendering, so each page calls verifySession() itself too.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { email } = await verifySession();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/projects" className={styles.brandLink}>
            <Logo muted />
          </Link>
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

      {children}
    </div>
  );
}
