// Merging extraction results from several documents.
//
// Chunked extraction reads each document on its own, so the same requirement
// arrives once per document that mentions it — and these three KYC documents
// deliberately overlap. Merging is deterministic string work, not a model call:
// it costs nothing, it is repeatable, and a merge that surprises you is a bug
// rather than a different opinion.
//
// No "server-only": pure functions, worth testing directly.

/** Dice coefficient over word bigrams. Order-insensitive and cheap. */
export function similarity(a: string, b: string): number {
  const bigrams = (text: string) => {
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    const pairs = new Set<string>();
    for (let i = 0; i < words.length - 1; i++) pairs.add(`${words[i]} ${words[i + 1]}`);
    // A single-word string has no bigrams; fall back to the word itself so short
    // titles can still match rather than silently scoring zero.
    if (pairs.size === 0 && words.length === 1) pairs.add(words[0]);
    return pairs;
  };

  const first = bigrams(a);
  const second = bigrams(b);
  if (first.size === 0 || second.size === 0) return 0;

  let shared = 0;
  for (const pair of first) if (second.has(pair)) shared++;
  return (2 * shared) / (first.size + second.size);
}

export type Mergeable = {
  title: string;
  description: string;
  evidence: string[];
  sourceFilenames: string[];
};

/**
 * Collapses records that describe the same thing.
 *
 * `score` decides which of two duplicates is kept — the richer record wins, and
 * the loser's evidence and source files are folded into it so the survivor
 * still traces back to every document that raised it.
 *
 * The threshold is deliberately high. A false merge silently destroys a
 * requirement; a missed merge leaves a visible duplicate that a person can
 * spot and fix. The cheap failure is the right one to prefer.
 */
export function mergeDuplicates<T extends Mergeable>(
  records: T[],
  score: (record: Mergeable) => number,
  threshold = 0.72,
): { merged: T[]; collapsed: number } {
  const kept: T[] = [];
  let collapsed = 0;

  for (const record of records) {
    const matchIndex = kept.findIndex((existing) => {
      const titleScore = similarity(existing.title, record.title);
      const bodyScore = similarity(existing.description, record.description);
      // Either a very close title, or a good title plus a corroborating body.
      return titleScore >= 0.85 || (titleScore >= threshold && bodyScore >= 0.5);
    });

    if (matchIndex === -1) {
      kept.push({ ...record });
      continue;
    }

    collapsed++;
    const existing = kept[matchIndex];
    const winner = score(record) > score(existing) ? record : existing;
    const loser = winner === record ? existing : record;

    kept[matchIndex] = {
      ...winner,
      // Union both sides: the survivor must still point at every document that
      // raised it, or chunking would quietly narrow traceability.
      evidence: [...new Set([...winner.evidence, ...loser.evidence])],
      sourceFilenames: [...new Set([...winner.sourceFilenames, ...loser.sourceFilenames])],
    };
  }

  return { merged: kept, collapsed };
}

// Both scorers read fields defensively rather than by exact shape. A record
// arriving from the model may leave a nullable field undefined rather than
// null, and a scorer is not the place to be strict about that.
const count = (value: unknown) => (Array.isArray(value) ? value.length : 0);
const filled = (value: unknown) => (value ? 1 : 0);

// Scorers read optional fields off a Mergeable, so they index through an
// unknown-valued view rather than asserting a shape the caller may not have.
const view = (r: Mergeable) => r as Mergeable & Record<string, unknown>;

/** How much a feature record actually says — used to pick the survivor. */
export function featureRichness(record: Mergeable): number {
  const r = view(record);
  return (
    r.description.length / 100 +
    count(r.bddAcceptanceCriteria) * 2 +
    count(r.checklistAcceptanceCriteria) * 2 +
    count(r.validationGates) +
    count(r.alternateFlows) +
    count(r.evidence) +
    filled(r.happyPath) * 3 +
    filled(r.actor) +
    (typeof r.completionScore === "number" ? r.completionScore / 20 : 0)
  );
}

/** How much a child record says. Children are short, so this stays simple. */
export function childRichness(record: Mergeable): number {
  return record.description.length / 100 + count(view(record).evidence);
}
