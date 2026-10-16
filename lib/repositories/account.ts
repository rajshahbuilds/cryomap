import { type Db, check } from "./_support";

export const accountRepo = (db: Db) => ({
  /**
   * Permanently delete the caller's account via the `delete_account` RPC
   * (SECURITY DEFINER — clients can't delete auth users directly). Workspaces
   * where the caller is the only admin are deleted too, but only those listed
   * in `confirmedWorkspaceIds`; if any other sole-admin workspace exists the
   * RPC refuses and nothing is deleted.
   */
  async delete(confirmedWorkspaceIds: string[]): Promise<void> {
    const res = await db.rpc("delete_account", {
      confirmed_workspace_ids: confirmedWorkspaceIds,
    });
    check(res);
  },
});
