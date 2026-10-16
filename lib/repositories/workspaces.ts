import type { Workspace, WorkspaceUpdateInput } from "@/lib/types";
import { type Db, check, unwrap, unwrapNullable } from "./_support";

export const workspacesRepo = (db: Db) => ({
  /** Workspaces visible to the caller (RLS scopes this to their memberships). */
  async list(): Promise<Workspace[]> {
    const res = await db
      .from("workspaces")
      .select("*")
      .order("created_at", { ascending: true });
    return unwrap(res) as Workspace[];
  },

  async get(id: string): Promise<Workspace | null> {
    const res = await db
      .from("workspaces")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return unwrapNullable(res) as Workspace | null;
  },

  /**
   * Create a workspace and make the caller its first admin, atomically. Goes
   * through the `create_workspace` RPC (SECURITY DEFINER) rather than a direct
   * insert: under RLS you can't add your own membership before you're an admin,
   * nor see the workspace before you're a member.
   */
  async create(name: string): Promise<Workspace> {
    const res = await db.rpc("create_workspace", { workspace_name: name });
    return unwrap(res) as Workspace;
  },

  async update(id: string, patch: WorkspaceUpdateInput): Promise<Workspace> {
    const res = await db
      .from("workspaces")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    return unwrap(res) as Workspace;
  },

  /** Delete a workspace (admin-only via RLS); cascades to its fridges + data. */
  async delete(id: string): Promise<void> {
    const res = await db.from("workspaces").delete().eq("id", id);
    check(res);
  },
});
