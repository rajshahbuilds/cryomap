import type { WorkspaceInvite, WorkspaceRole } from "@/lib/types";
import type { RedeemResult } from "@/lib/workspaces/invites";
import { type Db, check, unwrap } from "./_support";

export interface InviteCreateInput {
  workspace_id: string;
  token: string;
  role: WorkspaceRole;
  expires_at?: string | null;
}

export const workspaceInvitesRepo = (db: Db) => ({
  /**
   * Invite links for a workspace (RLS: admins only). Includes revoked/expired
   * rows; callers filter with the pure invite helpers. Redemption does NOT go
   * through here — it uses the `redeem_invite` RPC, so a not-yet-member
   * can join without read access to this table.
   */
  async listForWorkspace(workspaceId: string): Promise<WorkspaceInvite[]> {
    const res = await db
      .from("workspace_invites")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    return unwrap(res) as WorkspaceInvite[];
  },

  async create(
    input: InviteCreateInput,
    createdBy?: string,
  ): Promise<WorkspaceInvite> {
    const res = await db
      .from("workspace_invites")
      .insert({ ...input, created_by: createdBy ?? null })
      .select()
      .single();
    return unwrap(res) as WorkspaceInvite;
  },

  async revoke(id: string, now: Date = new Date()): Promise<void> {
    const res = await db
      .from("workspace_invites")
      .update({ revoked_at: now.toISOString() })
      .eq("id", id);
    check(res);
  },

  /** Redeem a token via the SECURITY DEFINER RPC: joins the caller if valid. */
  async redeem(token: string): Promise<RedeemResult> {
    const res = await db.rpc("redeem_invite", { invite_token: token });
    return unwrap(res) as unknown as RedeemResult;
  },
});
