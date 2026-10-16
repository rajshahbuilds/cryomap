"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setActiveWorkspace } from "@/app/workspaces/actions";

interface WorkspaceOption {
  id: string;
  name: string;
}

const itemClass =
  "flex w-full items-center justify-between gap-3 rounded-md px-3 py-1.5 text-left text-sm text-foreground transition hover:bg-background disabled:opacity-60";

/**
 * Active-workspace selector for the app chrome: a styled dropdown that switches
 * the workspace (persisted server-side) and offers "New workspace". With no
 * workspaces it just offers to create one.
 */
export function WorkspaceSwitcher({
  workspaces,
  activeId,
}: {
  workspaces: WorkspaceOption[];
  activeId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const close = () => detailsRef.current?.removeAttribute("open");

  if (workspaces.length === 0) {
    return (
      <Link
        href="/workspaces/new"
        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-background"
      >
        Create workspace
      </Link>
    );
  }

  const activeName =
    workspaces.find((w) => w.id === activeId)?.name ?? "Workspace";

  const switchTo = (id: string) => {
    close();
    if (id === activeId) return;
    startTransition(async () => {
      await setActiveWorkspace(id);
      router.refresh();
    });
  };

  return (
    <details ref={detailsRef} className="relative">
      <summary
        aria-label="Switch workspace"
        className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-background [&::-webkit-details-marker]:hidden"
      >
        <span className="max-w-[12rem] truncate">{activeName}</span>
        <span aria-hidden className="text-xs text-muted">
          ▾
        </span>
      </summary>
      <div className="absolute left-0 z-20 mt-1 w-60 rounded-lg border border-border bg-surface p-1 shadow-md">
        <p className="px-3 pb-1 pt-1.5 text-xs font-medium uppercase tracking-wide text-muted">
          Workspaces
        </p>
        {workspaces.map((w) => (
          <button
            key={w.id}
            type="button"
            disabled={pending}
            className={itemClass}
            onClick={() => switchTo(w.id)}
          >
            <span className="truncate">{w.name}</span>
            {w.id === activeId ? (
              <span aria-hidden className="text-status-working">
                ✓
              </span>
            ) : null}
          </button>
        ))}
        <div className="my-1 h-px bg-border" />
        <Link href="/workspaces/new" className={itemClass} onClick={close}>
          + New workspace
        </Link>
      </div>
    </details>
  );
}
