import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DiagramEditor } from "@/components/diagram/DiagramEditor";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/config";
import { fridgesRepo, workspaceMembersRepo } from "@/lib/repositories";
import { canEdit as roleCanEdit } from "@/lib/workspaces/permissions";

/**
 * Fridge editor shell. Server-side: auth + existence check; the diagram itself
 * is loaded client-side by `DiagramEditor` (read-only in Phase 2).
 */
export default async function FridgeEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_PATH);

  const fridge = await fridgesRepo(supabase).get(id);
  if (!fridge) notFound();

  // Editing requires editor+ in the fridge's workspace. A viewer (or non-member)
  // gets a read-only editor and can't check out. Legacy fridges with no
  // workspace stay editable (none exist today, but don't lock them out).
  const memberships = fridge.workspace_id
    ? await workspaceMembersRepo(supabase).listForUser(user.id)
    : [];
  const role =
    memberships.find((m) => m.workspace_id === fridge.workspace_id)?.role ??
    null;
  const canEditRole =
    fridge.workspace_id == null || (role != null && roleCanEdit(role));

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-2">
        <Link
          href="/fridges"
          className="text-sm text-muted transition hover:text-foreground"
        >
          ← Fridges
        </Link>
        <p className="text-xs text-muted">
          Scroll or Space+drag to pan · pinch or ⌘/Ctrl+scroll to zoom
        </p>
      </header>

      <div className="relative flex-1 bg-background">
        <DiagramEditor
          fridgeId={id}
          userId={user.id}
          canEditRole={canEditRole}
        />
      </div>
    </div>
  );
}
