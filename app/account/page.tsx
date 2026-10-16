import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountSettings } from "@/components/auth/AccountSettings";
import { LOGIN_PATH } from "@/lib/auth/config";
import {
  fridgesRepo,
  workspaceMembersRepo,
  workspacesRepo,
} from "@/lib/repositories";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLastAdmin } from "@/lib/workspaces/members";

export const metadata: Metadata = {
  title: "Account · CryoMap",
};

/** Account settings: who you're signed in as, and account deletion. */
export default async function AccountPage() {
  const db = await createSupabaseServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect(LOGIN_PATH);

  const [workspaces, memberships] = await Promise.all([
    workspacesRepo(db).list(),
    workspaceMembersRepo(db).listForUser(user.id),
  ]);

  // Workspaces where the user is the only admin — deleting the account deletes
  // these too, so the confirmation lists them with what they contain.
  const adminOf = workspaces.filter((w) =>
    memberships.some((m) => m.workspace_id === w.id && m.role === "admin"),
  );
  const soleAdmin = (
    await Promise.all(
      adminOf.map(async (w) => {
        const [members, fridges] = await Promise.all([
          workspaceMembersRepo(db).listForWorkspace(w.id),
          fridgesRepo(db).listForWorkspace(w.id),
        ]);
        if (!isLastAdmin(members, user.id)) return null;
        return {
          id: w.id,
          name: w.name,
          otherMembers: members.length - 1,
          fridgeCount: fridges.length,
        };
      }),
    )
  ).filter((w) => w !== null);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <AccountSettings
        email={user.email ?? null}
        hasWorkspace={workspaces.length > 0}
        soleAdminWorkspaces={soleAdmin}
      />
    </main>
  );
}
