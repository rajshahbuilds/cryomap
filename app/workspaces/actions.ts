"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/lib/auth/config";
import {
  workspaceInvitesRepo,
  workspaceMembersRepo,
  workspacesRepo,
} from "@/lib/repositories";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { errorToMessage } from "@/lib/toast/errorMessage";
import type { WorkspaceRole } from "@/lib/types";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspaces/active";
import {
  parseWorkspaceForm,
  type WorkspaceFormState,
} from "@/lib/workspaces/create";
import {
  generateInviteToken,
  inviteStatusMessage,
  isJoinSuccess,
} from "@/lib/workspaces/invites";

/** Resolve the signed-in user (redirecting home if absent). */
async function requireUserDb() {
  const db = await createSupabaseServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect(LOGIN_PATH);
  return { db, userId: user.id };
}

/** Result of a member-management action (consumed by the M4 settings UI). */
export interface MemberActionResult {
  error?: string;
}

/** Create a workspace and make the caller its admin (atomic, via RPC). */
export async function createWorkspace(
  _prev: WorkspaceFormState,
  formData: FormData,
): Promise<WorkspaceFormState> {
  const parsed = parseWorkspaceForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const db = await createSupabaseServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect(LOGIN_PATH);

  try {
    await workspacesRepo(db).create(parsed.data.name);
  } catch {
    return { error: "Could not create the workspace. Please try again." };
  }

  revalidatePath("/fridges");
  redirect("/fridges");
}

/** Switch the active workspace (persists the choice in a cookie). */
export async function setActiveWorkspace(id: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
  revalidatePath("/fridges");
}

/** Rename a workspace (admin-only, per RLS). */
export async function renameWorkspace(
  workspaceId: string,
  formData: FormData,
): Promise<MemberActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Workspace name is required." };
  const { db } = await requireUserDb();
  try {
    await workspacesRepo(db).update(workspaceId, { name });
  } catch (e) {
    return { error: errorToMessage(e) };
  }
  revalidatePath(`/workspaces/${workspaceId}/settings`);
  revalidatePath("/fridges");
  return {};
}

/** Delete a workspace and everything in it (admin-only, per RLS; cascades). */
export async function deleteWorkspace(
  workspaceId: string,
): Promise<MemberActionResult> {
  const { db } = await requireUserDb();
  try {
    await workspacesRepo(db).delete(workspaceId);
  } catch (e) {
    return { error: errorToMessage(e) };
  }
  revalidatePath("/fridges");
  return {};
}

// Member management. Admin-only operations are enforced by RLS; the last-admin
// rule is enforced by the DB trigger. These actions surface failures as messages
// for the settings UI.

/** Change a member's role (admin-only, per RLS). */
export async function changeMemberRole(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
): Promise<MemberActionResult> {
  const { db } = await requireUserDb();
  try {
    await workspaceMembersRepo(db).updateRole(workspaceId, userId, role);
  } catch (e) {
    return { error: errorToMessage(e) };
  }
  revalidatePath("/fridges");
  return {};
}

/** Remove a member from a workspace (admin-only, per RLS). */
export async function removeMember(
  workspaceId: string,
  userId: string,
): Promise<MemberActionResult> {
  const { db } = await requireUserDb();
  try {
    await workspaceMembersRepo(db).remove(workspaceId, userId);
  } catch (e) {
    return { error: errorToMessage(e) };
  }
  revalidatePath("/fridges");
  return {};
}

/** Leave a workspace (removes the caller's own membership). */
export async function leaveWorkspace(
  workspaceId: string,
): Promise<MemberActionResult> {
  const { db, userId } = await requireUserDb();
  try {
    await workspaceMembersRepo(db).remove(workspaceId, userId);
  } catch (e) {
    return { error: errorToMessage(e) };
  }
  revalidatePath("/fridges");
  return {};
}

// Invite links --------------------------------------------------------------

/** Result of generating an invite link (consumed by the M4 settings UI). */
export interface InviteCreateResult {
  token?: string;
  error?: string;
}

/** Generate a shareable invite link (admin-only, per RLS). */
export async function createInviteLink(
  workspaceId: string,
  role: WorkspaceRole,
  expiresAt?: string | null,
): Promise<InviteCreateResult> {
  const { db, userId } = await requireUserDb();
  const token = generateInviteToken();
  try {
    await workspaceInvitesRepo(db).create(
      { workspace_id: workspaceId, token, role, expires_at: expiresAt ?? null },
      userId,
    );
  } catch (e) {
    return { error: errorToMessage(e) };
  }
  return { token };
}

/** Revoke an invite link so it can no longer be redeemed (admin-only). */
export async function revokeInviteLink(
  inviteId: string,
): Promise<MemberActionResult> {
  const { db } = await requireUserDb();
  try {
    await workspaceInvitesRepo(db).revoke(inviteId);
  } catch (e) {
    return { error: errorToMessage(e) };
  }
  return {};
}

/** Form state for the join page. */
export interface JoinState {
  error?: string;
}

/**
 * Redeem an invite token for the signed-in user. On success, set it active and
 * head to the fridge list; otherwise return a message for the join page to show.
 */
export async function acceptInvite(
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const token = String(formData.get("token") ?? "");
  const { db } = await requireUserDb();

  let result;
  try {
    result = await workspaceInvitesRepo(db).redeem(token);
  } catch (e) {
    return { error: errorToMessage(e) };
  }

  if (isJoinSuccess(result.status)) {
    if (result.workspace_id) {
      const cookieStore = await cookies();
      cookieStore.set(ACTIVE_WORKSPACE_COOKIE, result.workspace_id, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
      });
    }
    revalidatePath("/fridges");
    redirect("/fridges");
  }

  return { error: inviteStatusMessage(result.status) };
}
