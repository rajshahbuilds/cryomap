import type { WorkspaceMember, WorkspaceRole } from "@/lib/types";
import { type Db, check, unwrap } from "./_support";

export interface MemberAddInput {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
}

export const workspaceMembersRepo = (db: Db) => ({
  /** Everyone in a workspace (RLS: visible to members of that workspace). */
  async listForWorkspace(workspaceId: string): Promise<WorkspaceMember[]> {
    const res = await db
      .from("workspace_members")
      .select("*")
      .eq("workspace_id", workspaceId);
    return unwrap(res) as WorkspaceMember[];
  },

  /** The caller's memberships — used to build their workspace list/switcher. */
  async listForUser(userId: string): Promise<WorkspaceMember[]> {
    const res = await db
      .from("workspace_members")
      .select("*")
      .eq("user_id", userId);
    return unwrap(res) as WorkspaceMember[];
  },

  async add(input: MemberAddInput): Promise<WorkspaceMember> {
    const res = await db
      .from("workspace_members")
      .insert(input)
      .select()
      .single();
    return unwrap(res) as WorkspaceMember;
  },

  async updateRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMember> {
    const res = await db
      .from("workspace_members")
      .update({ role })
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .select()
      .single();
    return unwrap(res) as WorkspaceMember;
  },

  async remove(workspaceId: string, userId: string): Promise<void> {
    const res = await db
      .from("workspace_members")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId);
    check(res);
  },
});
