import "server-only";
import { prisma } from "@/lib/db/client";
import { requireCurrentUser } from "@/lib/auth/current-user";
import type { ProjectAccessEntry, User } from "@/lib/schemas/entities";
import { projectRoleSchema, type ProjectRole } from "@/lib/schemas/enums";

/**
 * Per-project access control.
 *
 * Modelled as capabilities rather than a role hierarchy. A hierarchy would
 * force a false ordering — an ARCHITECT is not "more" than a BA, they simply do
 * different things — and would make REVIEWER, which is read-only regardless of
 * seniority, impossible to express.
 *
 * Absence of a ProjectAccess row means no access. There is no implicit read.
 */

export type Capability =
  /** See the project and everything in it. */
  | "read"
  /** Add, edit or remove source documents. */
  | "manage_sources"
  /** Confirm or reject that a source is a faithful record of its origin. */
  | "validate_sources"
  /** Run AI extraction over validated sources. */
  | "run_extraction"
  /** Change project settings, including domain context and status. */
  | "manage_project"
  /** Grant or revoke other people's access. */
  | "manage_access"
  /** Delete the project and everything under it. */
  | "delete_project";

const CAPABILITIES: Record<ProjectRole, Capability[]> = {
  OWNER: [
    "read",
    "manage_sources",
    "validate_sources",
    "run_extraction",
    "manage_project",
    "manage_access",
    "delete_project",
  ],
  PM: ["read", "manage_sources", "validate_sources", "run_extraction", "manage_project"],
  // Validation is an authority check, not an analysis task: it says the
  // material is authoritative enough to build on. BA and FA bring material in
  // and extract from it, but do not vouch for it — per the Phase 2 spec.
  BA: ["read", "manage_sources", "run_extraction"],
  FA: ["read", "manage_sources", "run_extraction"],
  ARCHITECT: ["read", "manage_sources", "validate_sources", "run_extraction"],
  // Deliberately read-only. A reviewer who can edit is not a reviewer.
  //
  // `validate_sources` is held by exactly the roles that hold `manage_sources`
  // today, which makes it look redundant. It is separate because the two are
  // different acts — bringing material in, and vouching for it — and the day
  // that distinction matters (a reviewer who may vouch but not edit, a client
  // who validates their own transcripts) it is one line here rather than a
  // rewrite of every call site.
  REVIEWER: ["read"],
};

export function roleHas(role: ProjectRole, capability: Capability): boolean {
  return CAPABILITIES[role].includes(capability);
}

export function capabilitiesOf(role: ProjectRole): Capability[] {
  return CAPABILITIES[role];
}

/**
 * Returns the user's access record for a project, or null if they have none.
 *
 * When `requiredRole` is given, returns the record only if the role matches
 * exactly. Prefer `requireCapability` for authorisation — a check written
 * against a role has to be revisited every time the role list changes, whereas
 * one written against a capability does not.
 */
export async function checkProjectAccess(
  projectId: string,
  userId: string,
  requiredRole?: ProjectRole,
): Promise<ProjectAccessEntry | null> {
  const row = await prisma.projectAccess.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!row) return null;

  const role = projectRoleSchema.safeParse(row.role);
  if (!role.success) return null;
  if (requiredRole && role.data !== requiredRole) return null;

  return {
    id: row.id,
    projectId: row.projectId,
    userId: row.userId,
    role: role.data,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class AccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessDeniedError";
  }
}

export type Actor = {
  user: User;
  role: ProjectRole;
};

/**
 * The gate every write goes through. Resolves the acting user, confirms they
 * hold the capability on this project, and hands back both — so a caller cannot
 * authorise without also having the identity it needs for attribution.
 */
export async function requireCapability(
  projectId: string,
  capability: Capability,
): Promise<Actor> {
  const user = await requireCurrentUser();
  const access = await checkProjectAccess(projectId, user.id);

  if (!access) {
    throw new AccessDeniedError(
      "You do not have access to this project. Ask an owner to add you.",
    );
  }

  if (!roleHas(access.role, capability)) {
    throw new AccessDeniedError(
      `Your role on this project (${access.role}) does not allow this. ${DENIAL_HINTS[capability]}`,
    );
  }

  return { user, role: access.role };
}

const DENIAL_HINTS: Record<Capability, string> = {
  read: "Ask an owner for access.",
  manage_sources: "Sources can be added by an owner, PM, BA, FA or architect.",
  validate_sources:
    "Only an owner, PM or architect can validate a source as authoritative.",
  run_extraction:
    "Extraction can be run by an owner, PM, BA, FA or architect. Reviewers are read-only.",
  manage_project: "Project settings can be changed by an owner or PM.",
  manage_access: "Only an owner can change who has access.",
  delete_project: "Only an owner can delete a project.",
};

/** Non-throwing variant, for deciding whether to render a control. */
export async function currentUserCan(
  projectId: string,
  capability: Capability,
): Promise<boolean> {
  try {
    await requireCapability(projectId, capability);
    return true;
  } catch {
    return false;
  }
}

/** The acting user's role on a project, or null if they have no access. */
export async function currentUserRole(
  projectId: string,
): Promise<ProjectRole | null> {
  const user = await requireCurrentUser();
  const access = await checkProjectAccess(projectId, user.id);
  return access?.role ?? null;
}
