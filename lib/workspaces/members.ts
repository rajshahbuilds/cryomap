import type { WorkspaceMember } from "@/lib/types";

/** How many admins a workspace has. */
export function adminCount(members: WorkspaceMember[]): number {
  return members.filter((m) => m.role === "admin").length;
}

/**
 * Would removing or demoting this member strip the workspace of its last admin?
 * Mirrors the DB guard (the `workspace_members_keep_admin` trigger) so the UI
 * can disable the action and explain why before the server rejects it.
 */
export function isLastAdmin(
  members: WorkspaceMember[],
  userId: string,
): boolean {
  const target = members.find((m) => m.user_id === userId);
  return target?.role === "admin" && adminCount(members) <= 1;
}
