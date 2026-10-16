import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { WorkspaceSettings } from "@/components/workspace/WorkspaceSettings";
import { LOGIN_PATH } from "@/lib/auth/config";
import {
  fridgesRepo,
  profilesRepo,
  workspaceInvitesRepo,
  workspaceMembersRepo,
  workspacesRepo,
} from "@/lib/repositories";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Workspace settings · CryoMap",
};

/** Workspace settings: rename, members + roles, invite links. */
export default async function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await createSupabaseServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect(LOGIN_PATH);

  // RLS returns the workspace only to members; null ⇒ not a member / not found.
  const workspace = await workspacesRepo(db).get(id);
  if (!workspace) notFound();

  const [members, profiles, invites, fridges] = await Promise.all([
    workspaceMembersRepo(db).listForWorkspace(id),
    profilesRepo(db).list(),
    // Admin-only by RLS — non-admins get an empty list (no error).
    workspaceInvitesRepo(db).listForWorkspace(id),
    fridgesRepo(db).listForWorkspace(id),
  ]);

  const me = members.find((m) => m.user_id === user.id);
  if (!me) notFound();

  const nameById = new Map(
    profiles.map((p) => [p.id, p.display_name ?? p.email ?? "Member"] as const),
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <WorkspaceSettings
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        myRole={me.role}
        currentUserId={user.id}
        members={members.map((m) => ({
          userId: m.user_id,
          name: nameById.get(m.user_id) ?? "Member",
          role: m.role,
          joinedAt: m.created_at,
        }))}
        invites={invites.map((i) => ({
          id: i.id,
          token: i.token,
          role: i.role,
          expiresAt: i.expires_at,
          revokedAt: i.revoked_at,
          createdAt: i.created_at,
        }))}
        fridgeCount={fridges.length}
      />
    </main>
  );
}
