"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/lib/auth/config";
import { accountRepo } from "@/lib/repositories";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { errorToMessage } from "@/lib/toast/errorMessage";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspaces/active";

export interface DeleteAccountResult {
  error?: string;
}

/**
 * Permanently delete the signed-in user's account, plus the workspaces they
 * confirmed (those where they're the only admin). On success, clear the session
 * and return to the login page.
 */
export async function deleteAccount(
  confirmedWorkspaceIds: string[],
): Promise<DeleteAccountResult> {
  const db = await createSupabaseServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect(LOGIN_PATH);

  try {
    await accountRepo(db).delete(confirmedWorkspaceIds);
  } catch (e) {
    return { error: errorToMessage(e, "Couldn’t delete your account") };
  }

  // The auth user (and its sessions) are gone; drop the local cookies too.
  // Errors are expected here — the server no longer knows this session.
  await db.auth.signOut({ scope: "local" }).catch(() => {});
  (await cookies()).delete(ACTIVE_WORKSPACE_COOKIE);
  redirect(LOGIN_PATH);
}
