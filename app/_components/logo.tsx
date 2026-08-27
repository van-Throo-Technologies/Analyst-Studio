import styles from "./logo.module.css";

// The product mark: a white lemniscate on a blue rounded square. Drawn inline
// rather than loaded from /public so it inherits currentColor and never causes
// a second request or a flash before the brand renders.
//
// Swap for the real asset when it exists — drop an SVG in /public and replace
// the <svg> below with next/image, keeping the same wrapper classes.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      className={`${styles.mark} ${className ?? ""}`}
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path
        d="M11.3 12.5c-3.1 0-4.9 1.6-4.9 3.5s1.8 3.5 4.9 3.5c3.4 0 5.9-7 9.4-7 3.1 0 4.9 1.6 4.9 3.5s-1.8 3.5-4.9 3.5c-3.5 0-6-7-9.4-7z"
        fill="none"
        stroke="#fff"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

// The mark plus the wordmark. `muted` renders it at the smaller, lighter weight
// used as secondary chrome — on the legal pages, where the document title
// carries the emphasis instead.
export function Logo({ muted = false }: { muted?: boolean }) {
  return (
    <span className={styles.lockup}>
      <LogoMark />
      <span className={muted ? styles.wordmarkMuted : styles.wordmark}>
        Analyst Studio
      </span>
    </span>
  );
}
