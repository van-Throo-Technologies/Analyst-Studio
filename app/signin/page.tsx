import { signIn } from "../../lib/auth";
import styles from "./signin.module.css";

// Auth.js reports failures by redirecting back here with ?error=<code>. The
// codes are deliberately coarse so they cannot be used to probe which addresses
// have accounts, so the messages stay coarse too.
const ERRORS: Record<string, string> = {
  EmailSignin: "That email could not be sent. Check the address and try again.",
  Verification: "That link has expired or was already used. Request a new one.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.title}>Sign in to Analyst Studio</h1>
        <p className={styles.blurb}>
          Enter your email and we&apos;ll send you a link that signs you in. No
          password to remember.
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
          <label htmlFor="email" className={styles.blurb} style={{ marginBottom: 0 }}>
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            className={styles.input}
          />
          <button type="submit" className={styles.button}>
            Email me a sign-in link
          </button>
        </form>
      </div>
    </main>
  );
}
