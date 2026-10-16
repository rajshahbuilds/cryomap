import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SnapshotPreview } from "@/components/diagram/SnapshotPreview";
import { versionLabel } from "@/lib/diagram/restore";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/config";
import { versionsRepo } from "@/lib/repositories";

/** Read-only historical preview of a single version. */
export default async function VersionPreviewPage({
  params,
}: {
  params: Promise<{ id: string; versionId: string }>;
}) {
  const { id, versionId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_PATH);

  const version = await versionsRepo(supabase).get(versionId);
  if (!version || version.fridge_id !== id) notFound();

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-2">
        <Link
          href={`/fridges/${id}/versions`}
          className="text-sm text-muted transition hover:text-foreground"
        >
          ← History
        </Link>
        <h1 className="truncate text-sm font-semibold text-foreground">
          {version.commit_message}
        </h1>
      </header>

      <div className="relative min-h-0 flex-1 bg-background">
        <SnapshotPreview
          snapshot={version.snapshot}
          label={versionLabel(version)}
        />
      </div>
    </div>
  );
}
