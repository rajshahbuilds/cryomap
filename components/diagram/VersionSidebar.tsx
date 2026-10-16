import Link from "next/link";
import type { Version } from "@/lib/types";

interface VersionSidebarProps {
  fridgeId: string;
  versions: Version[];
  /** Show Restore actions (only when the diagram is checked out by the user). */
  canRestore?: boolean;
  onRestore?: (version: Version) => void;
  onClose?: () => void;
}

function Badge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "planned";
}) {
  return (
    <span
      className={`rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium ${
        tone === "planned" ? "text-status-planned" : "text-muted"
      }`}
    >
      {children}
    </span>
  );
}

/** History list of versions (newest first) with metadata + preview/restore. */
export function VersionSidebar({
  fridgeId,
  versions,
  canRestore = false,
  onRestore,
  onClose,
}: VersionSidebarProps) {
  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-border bg-surface">
      <header className="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 className="text-sm font-semibold text-foreground">History</h2>
        {onClose ? (
          <button
            type="button"
            aria-label="Close history"
            onClick={onClose}
            className="text-muted hover:text-foreground"
          >
            ✕
          </button>
        ) : null}
      </header>

      {versions.length === 0 ? (
        <p className="p-4 text-sm text-muted">No versions yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {versions.map((version) => (
            <li key={version.id} className="space-y-1.5 p-3">
              <p className="text-sm font-medium text-foreground">
                {version.commit_message}
              </p>
              <p className="text-xs text-muted">
                {version.author_name ?? "Unknown"} ·{" "}
                {new Date(version.created_at).toLocaleString()}
              </p>
              <div className="flex flex-wrap items-center gap-1">
                {version.tag ? <Badge>{version.tag}</Badge> : null}
                <Badge
                  tone={
                    version.snapshot_type === "planned" ? "planned" : "muted"
                  }
                >
                  {version.snapshot_type}
                </Badge>
              </div>
              <div className="flex items-center gap-3 pt-0.5 text-xs">
                <Link
                  href={`/fridges/${fridgeId}/versions/${version.id}`}
                  className="text-status-planned hover:underline"
                >
                  Preview
                </Link>
                {canRestore && onRestore ? (
                  <button
                    type="button"
                    onClick={() => onRestore(version)}
                    className="text-foreground hover:underline"
                  >
                    Restore
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
