import type { WorkspaceRole } from "@/lib/types";

/**
 * What a workspace role is allowed to do — the single source of truth shared by
 * the UI (to show/hide actions) and server guards (to enforce them). Pure: no
 * React, no Supabase. RLS is the real boundary; these mirror it for UX + checks.
 *
 * Roles rank viewer < editor < admin, each inheriting the lower role's abilities.
 */
const RANK: Record<WorkspaceRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
};

/** Does `role` meet or exceed `minimum` in the rank order? */
export function hasAtLeast(
  role: WorkspaceRole,
  minimum: WorkspaceRole,
): boolean {
  return RANK[role] >= RANK[minimum];
}

/** Editors and admins can edit diagrams — and so may take the checkout lock. */
export function canEdit(role: WorkspaceRole): boolean {
  return hasAtLeast(role, "editor");
}

/** Only admins manage members, invite links, and workspace settings. */
export function canManageMembers(role: WorkspaceRole): boolean {
  return role === "admin";
}

/** Convenience alias: admins administer the workspace (settings/invites). */
export function isAdmin(role: WorkspaceRole): boolean {
  return role === "admin";
}

/** Viewers are strictly read-only. */
export function isViewer(role: WorkspaceRole): boolean {
  return role === "viewer";
}
