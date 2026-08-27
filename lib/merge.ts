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

type Mergeable = {
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
  score: (record: T) => number,
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

/** How much a feature record actually says — used to pick the survivor. */
export function featureRichness(r: {
  description: string;
  bddAcceptanceCriteria: string[];
  checklistAcceptanceCriteria: string[];
  validationGates: string[];
  alternateFlows: string[];
  evidence: string[];
  happyPath: string | null;
  actor: string | null;
  completionScore: number;
}): number {
  return (
    r.description.length / 100 +
    r.bddAcceptanceCriteria.length * 2 +
    r.checklistAcceptanceCriteria.length * 2 +
    r.validationGates.length +
    r.alternateFlows.length +
    r.evidence.length +
    (r.happyPath ? 3 : 0) +
    (r.actor ? 1 : 0) +
    r.completionScore / 20
  );
}

/** How much a child record says. Children are short, so this stays simple. */
export function childRichness(r: { description: string; evidence: string[] }): number {
  return r.description.length / 100 + r.evidence.length;
}
