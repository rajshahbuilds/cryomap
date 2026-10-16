import { cookies } from "next/headers";
import type { Workspace } from "@/lib/types";
import { workspacesRepo, type Db } from "@/lib/repositories";
import { ACTIVE_WORKSPACE_COOKIE, resolveActiveWorkspace } from "./active";

/**
 * Server-side: the user's workspaces (RLS-scoped to their memberships) and the
 * active one, resolved from the cookie. Used by the fridges page and the
 * create-fridge action so both agree on "which workspace are we in".
 */
export async function loadActiveWorkspace(
  db: Db,
): Promise<{ workspaces: Workspace[]; active: Workspace | null }> {
  const workspaces = await workspacesRepo(db).list();
  const cookieStore = await cookies();
  const cookieId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  return { workspaces, active: resolveActiveWorkspace(workspaces, cookieId) };
}
