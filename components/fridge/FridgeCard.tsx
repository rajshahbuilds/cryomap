import type { ReactNode } from "react";
import Link from "next/link";
import type { Fridge } from "@/lib/types";
import type { FridgeLockView } from "@/lib/locks/status";

/** Absolute date in UTC so it renders identically on server and in tests. */
function formatUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function LockBadge({ lock }: { lock: FridgeLockView }) {
  if (!lock.active) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-status-working">
        <span className="h-1.5 w-1.5 rounded-full bg-status-working" />
        Available
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-status-noisy">
      <span className="h-1.5 w-1.5 rounded-full bg-status-noisy" />
      {lock.holderName ? `In use · ${lock.holderName}` : "In use"}
    </span>
  );
}

interface FridgeCardProps {
  fridge: Fridge;
  lock: FridgeLockView;
  /** Optional overflow-menu slot rendered in the top-right corner. */
  actions?: ReactNode;
}

/** Presentational summary card for a single fridge. */
export function FridgeCard({ fridge, lock, actions }: FridgeCardProps) {
  const subtitle = [fridge.vendor, fridge.model].filter(Boolean).join(" · ");

  return (
    <article className="relative flex h-full flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-foreground">
            {/*
             * Stretched link: the title is the real, focusable link, and its
             * `after` overlay spans the whole (relative) card so a click
             * anywhere navigates. Interactive children (the menu) sit above it
             * via `relative z-10`.
             */}
            <Link
              href={`/fridges/${fridge.id}`}
              className="outline-none after:absolute after:inset-0 after:rounded-xl hover:underline focus-visible:underline"
            >
              {fridge.name}
            </Link>
          </h2>
          {subtitle ? (
            <p className="truncate text-sm text-muted">{subtitle}</p>
          ) : null}
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-2">
          {fridge.archived ? (
            <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-muted">
              Archived
            </span>
          ) : null}
          {actions}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 pt-2">
        <span className="text-xs text-muted">
          Updated {formatUpdated(fridge.updated_at)}
        </span>
        <LockBadge lock={lock} />
      </div>
    </article>
  );
}
