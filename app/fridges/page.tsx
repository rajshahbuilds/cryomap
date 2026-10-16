import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { FridgeCard } from "@/components/fridge/FridgeCard";
import { FridgeCardMenu } from "@/components/fridge/FridgeCardMenu";
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/config";
import { isLockActive } from "@/lib/locks/status";
import {
  fridgesRepo,
  locksRepo,
  profilesRepo,
  workspaceMembersRepo,
} from "@/lib/repositories";
import { loadActiveWorkspace } from "@/lib/workspaces/loadActive";
import { canEdit as roleCanEdit } from "@/lib/workspaces/permissions";

/**
 * Authenticated landing page: the grid of fridges in the active workspace.
 * Route protection is enforced by the middleware; the `getUser` check here is
 * defense-in-depth.
 */
export default async function FridgesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(LOGIN_PATH);

  const { workspaces, active } = await loadActiveWorkspace(supabase);
  // No workspace yet → the create-or-join onboarding screen.
  if (!active) redirect("/welcome");

  const switcher = (
    <WorkspaceSwitcher
      workspaces={workspaces.map((w) => ({ id: w.id, name: w.name }))}
      activeId={active.id}
    />
  );

  const [fridges, locks, profiles, memberships] = await Promise.all([
    fridgesRepo(supabase).listForWorkspace(active.id),
    locksRepo(supabase).list(),
    profilesRepo(supabase).list(),
    workspaceMembersRepo(supabase).listForUser(user.id),
  ]);

  // Editor+ in the active workspace → can create/manage fridges.
  const myRole =
    memberships.find((m) => m.workspace_id === active.id)?.role ?? null;
  const canEdit = myRole != null && roleCanEdit(myRole);

  const nameById = new Map(
    profiles.map((p) => [p.id, p.display_name] as const),
  );
  const lockByFridge = new Map(locks.map((l) => [l.fridge_id, l] as const));
  const now = new Date();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted">
            CryoMap
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            Fridges
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {switcher}
          <div className="h-6 w-px bg-border" aria-hidden />
          <Link
            href={`/workspaces/${active.id}/settings`}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-background"
          >
            Settings
          </Link>
          {canEdit ? (
            <Link
              href="/fridges/new"
              className="rounded-lg border border-transparent bg-foreground px-4 py-2 text-sm font-medium text-surface shadow-sm transition hover:opacity-90"
            >
              New fridge
            </Link>
          ) : null}
          <div className="h-6 w-px bg-border" aria-hidden />
          <AccountMenu />
        </div>
      </header>

      {fridges.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-base font-medium text-foreground">
            No fridges yet
          </p>
          {canEdit ? (
            <>
              <p className="mt-1 text-sm text-muted">
                Create your first dilution-fridge diagram to get started.
              </p>
              <Link
                href="/fridges/new"
                className="mt-4 inline-block rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-background"
              >
                New fridge
              </Link>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">
              No fridges in this workspace yet.
            </p>
          )}
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fridges.map((fridge) => {
            const lock = lockByFridge.get(fridge.id) ?? null;
            const active = isLockActive(lock, now);
            return (
              <li key={fridge.id}>
                <FridgeCard
                  fridge={fridge}
                  lock={{
                    active,
                    holderName:
                      active && lock?.locked_by
                        ? (nameById.get(lock.locked_by) ?? null)
                        : null,
                  }}
                  actions={
                    canEdit ? <FridgeCardMenu fridge={fridge} /> : undefined
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
