// Verifying that a quoted piece of evidence really appears in the source.
//
// This is the load-bearing check of the whole pipeline, and it is deliberately
// dumb: a literal match after normalisation. The model claims a quote; this
// decides whether the claim is true. Nothing here asks the model to grade its
// own work, which is why the answer can be trusted.
//
// No "server-only" — the same function is worth having in tests and the rules
// are pure string handling.

// Formatting drift is not paraphrase. Curly quotes, en dashes, non-breaking
// spaces and line wrapping all change the bytes without changing the words, so
// they are normalised away. Anything beyond that — a different number, a
// reworded phrase — must fail, because that is the failure worth catching.
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when `quote` appears verbatim in `source` once both are normalised.
 *
 * Very short quotes are rejected: "the system" appears in every transcript ever
 * written and proves nothing, so matching it would launder a fabrication into a
 * verified citation.
 */
export function isQuoteInSource(quote: string, source: string): boolean {
  const needle = normalise(quote);
  if (needle.length < 12) return false;
  return normalise(source).includes(needle);
}

export type GroundingResult = {
  verified: string[];
  unverified: string[];
  isGrounded: boolean;
};

/**
 * Splits a requirement's claimed evidence into quotes that check out and quotes
 * that do not. A requirement counts as grounded only when it offered at least
 * one quote and every quote it offered was found.
 */
export function verifyEvidence(quotes: string[], source: string): GroundingResult {
  const verified: string[] = [];
  const unverified: string[] = [];

  for (const quote of quotes) {
    if (isQuoteInSource(quote, source)) verified.push(quote);
    else unverified.push(quote);
  }

  return {
    verified,
    unverified,
    isGrounded: quotes.length > 0 && unverified.length === 0,
  };
}
