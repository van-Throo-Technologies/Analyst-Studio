import "server-only";
import { createHash } from "node:crypto";

/**
 * Content fingerprinting for source documents.
 *
 * The question a checksum answers here is narrow and specific: someone pastes
 * the workshop notes again three weeks later — is this the same material, or
 * has it changed since? Without it the answer is "the text looks similar", and
 * an analyst re-reads two thousand words to find out.
 *
 * Not a security control. It is a comparison key, and SHA-256 is used because
 * it is the obvious choice, not because anything here resists tampering.
 */

/**
 * Whitespace is normalised before hashing. A paste that differs only in line
 * endings or trailing spaces — which is what happens when the same document
 * travels through a different mail client — is the same material, and flagging
 * it as changed would train people to ignore the flag.
 */
export function contentChecksum(content: string): string {
  const normalised = content.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trim();
  return createHash("sha256").update(normalised, "utf8").digest("hex");
}

/** Short form for display. Enough to compare two by eye, short enough to read. */
export function shortChecksum(hash: string): string {
  return hash.slice(0, 12);
}
