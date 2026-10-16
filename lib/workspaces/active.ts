import type { Workspace } from "@/lib/types";

/** Cookie holding the user's currently-selected workspace id. */
export const ACTIVE_WORKSPACE_COOKIE = "cryomap_active_workspace";

/**
 * Pick the active workspace from the user's list: the cookie's choice if it's
 * still one they belong to, otherwise the first workspace, otherwise none.
 */
export function resolveActiveWorkspace(
  workspaces: Workspace[],
  cookieId: string | undefined,
): Workspace | null {
  if (workspaces.length === 0) return null;
  if (cookieId) {
    const match = workspaces.find((w) => w.id === cookieId);
    if (match) return match;
  }
  return workspaces[0];
}
