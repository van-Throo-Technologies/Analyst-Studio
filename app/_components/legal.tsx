import Link from "next/link";
import { Logo } from "./logo";
import styles from "./legal.module.css";

// A deliberate placeholder shell. The sign-up form links to these documents, so
// the routes must exist — but the actual terms are a legal question, not a
// drafting one, so no text is invented here. Replace `children` with the real
// document before testers are invited.
export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/signin" className={styles.brandLink}>
          <Logo muted />
        </Link>
      </header>

      <main className={styles.main}>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.body}>{children}</div>
        <Link href="/signin" className={styles.back}>
          ← Back to sign in
        </Link>
      </main>
    </div>
  );
}
