import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { VersionSidebar } from "@/components/diagram/VersionSidebar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/config";
import { fridgesRepo, versionsRepo } from "@/lib/repositories";

/** Full-page version history for a fridge. */
export default async function VersionsPage({
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

  const [fridge, versions] = await Promise.all([
    fridgesRepo(supabase).get(id),
    versionsRepo(supabase).listByFridge(id),
  ]);
  if (!fridge) notFound();

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-2">
        <Link
          href={`/fridges/${id}`}
          className="text-sm text-muted transition hover:text-foreground"
        >
          ← {fridge.name}
        </Link>
        <h1 className="text-sm font-semibold text-foreground">
          Version history
        </h1>
      </header>

      <div className="flex min-h-0 flex-1">
        <VersionSidebar fridgeId={id} versions={versions} />
        <div className="flex flex-1 items-center justify-center bg-background p-6 text-sm text-muted">
          Choose a version to preview.
        </div>
      </div>
    </div>
  );
}
