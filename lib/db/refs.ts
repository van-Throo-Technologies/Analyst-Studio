import "server-only";
import { prisma } from "@/lib/db/client";

/**
 * Human-facing reference codes (REQ-001, UC-004, AC-012).
 *
 * Analysts cite these in conversation and in the exported packs, so they must
 * be short, stable and unique per project. Ids stay opaque cuids; refs are the
 * label. Once assigned a ref is never reused, even after a delete, so an old
 * exported pack can never point at a different item than it did on the day it
 * was generated.
 */

const PREFIXES = {
  requirement: "REQ",
  useCase: "UC",
  acceptanceCriterion: "AC",
} as const;

export type RefKind = keyof typeof PREFIXES;

function nextNumber(existing: string[], prefix: string): number {
  let highest = 0;
  for (const ref of existing) {
    if (!ref.startsWith(`${prefix}-`)) continue;
    const parsed = Number.parseInt(ref.slice(prefix.length + 1), 10);
    if (Number.isFinite(parsed) && parsed > highest) highest = parsed;
  }
  return highest + 1;
}

function format(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

async function existingRefs(kind: RefKind, projectId: string): Promise<string[]> {
  const select = { ref: true } as const;
  const where = { projectId };
  switch (kind) {
    case "requirement":
      return (await prisma.requirement.findMany({ where, select })).map((r) => r.ref);
    case "useCase":
      return (await prisma.useCase.findMany({ where, select })).map((r) => r.ref);
    case "acceptanceCriterion":
      return (await prisma.acceptanceCriterion.findMany({ where, select })).map(
        (r) => r.ref,
      );
  }
}

/**
 * Allocate `count` consecutive refs. Batch AI jobs ask for all of their refs up
 * front so a single extraction run produces a contiguous, readable block.
 */
export async function allocateRefs(
  kind: RefKind,
  projectId: string,
  count: number,
): Promise<string[]> {
  if (count <= 0) return [];
  const prefix = PREFIXES[kind];
  const start = nextNumber(await existingRefs(kind, projectId), prefix);
  return Array.from({ length: count }, (_, i) => format(prefix, start + i));
}

export async function allocateRef(
  kind: RefKind,
  projectId: string,
): Promise<string> {
  const [ref] = await allocateRefs(kind, projectId, 1);
  return ref;
}
