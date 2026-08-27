import { signIn } from "../../lib/auth";
import styles from "./signin.module.css";

// Auth.js reports failures by redirecting back here with ?error=<code>. The
// codes are deliberately coarse so the form cannot be used to discover which
// addresses have accounts, so the messages stay coarse too.
const ERRORS: Record<string, string> = {
  EmailSignin: "That email could not be sent. Check the address and try again.",
  Verification: "That link has expired or was already used. Request a new one.",
};

// Placeholder mark. Swap for the real VanThroo asset when it is available —
// drop an SVG in /public and replace this with next/image.
function Logo() {
  return (
    <svg className={styles.logoMark} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <g fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round">
        <circle cx="12.4" cy="16" r="3.6" />
        <circle cx="19.6" cy="16" r="3.6" />
      </g>
    </svg>
  );
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className={styles.page}>
      <section className={styles.formSide}>
        <div className={styles.formInner}>
          <div className={styles.brand}>
            <Logo />
            <span className={styles.brandName}>VanThroo Technologies</span>
          </div>

          <h1 className={styles.title}>Sign in to Analyst Studio</h1>
          <p className={styles.subtitle}>
            Start turning messy discovery into structured analysis today.
          </p>

          {error && (
            <p className={styles.error} role="alert">
              {ERRORS[error] ?? "Something went wrong signing in. Please try again."}
            </p>
          )}

          <form
            className={styles.form}
            action={async (formData: FormData) => {
              "use server";
              await signIn("resend", {
                email: formData.get("email") as string,
                redirectTo: "/",
              });
            }}
          >
            <label className={styles.label} htmlFor="email">
              Email Address
            </label>
            <div className={styles.inputWrap}>
              <svg className={styles.inputIcon} viewBox="0 0 20 20" aria-hidden="true">
                <rect x="2.5" y="4.5" width="15" height="11" rx="2" fill="none"
                  stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 6l7 5 7-5" fill="none" stroke="currentColor"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
                required
                className={styles.input}
              />
            </div>

            <button type="submit" className={styles.button}>
              Email me a sign-in link
              <span aria-hidden="true" className={styles.arrow}>→</span>
            </button>
          </form>

          {/* No password field: sign-in is a one-time link, so there is no
              password to set, confirm, reset, or leak. */}
          <p className={styles.note}>
            We&apos;ll email you a secure link. No password to remember.
          </p>
        </div>
      </section>

      <aside className={styles.panel} aria-hidden="true">
        <div className={styles.panelInner}>
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardIcon}>
                <svg viewBox="0 0 20 20" width="18" height="18">
                  <path d="M10 2.6l1.5 4.2 4.2 1.5-4.2 1.5L10 14l-1.5-4.2L4.3 8.3l4.2-1.5z"
                    fill="#2563eb" />
                </svg>
              </span>
              <div>
                <p className={styles.cardEyebrow}>Analyst Studio AI</p>
                <p className={styles.cardBody}>
                  Upload your meeting transcripts. I&apos;ll automatically detect
                  actors, processes, and data flows.
                </p>
              </div>
            </div>
            <ul className={styles.rows}>
              <li className={styles.row}>
                <span className={`${styles.dot} ${styles.dotDone}`}>✓</span>
                <span className={styles.bar} style={{ width: "100%" }} />
              </li>
              <li className={styles.row}>
                <span className={`${styles.dot} ${styles.dotDone}`}>✓</span>
                <span className={styles.bar} style={{ width: "92%" }} />
              </li>
              <li className={styles.row}>
                <span className={styles.dot} />
                <span className={styles.bar} style={{ width: "78%" }} />
              </li>
            </ul>
          </div>

          <h2 className={styles.panelTitle}>
            One Workspace.
            <br />
            Multiple Analysis
            <br />
            Deliverables.
          </h2>
          <p className={styles.panelBlurb}>
            Built on a canonical requirement model to power both Business and
            Functional analysis workflows simultaneously.
          </p>
        </div>
      </aside>
    </div>
  );
}
