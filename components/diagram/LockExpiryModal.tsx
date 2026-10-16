"use client";

import type { LockRecovery } from "@/lib/locks/state";

interface LockExpiryModalProps {
  /** "reacquire" when the lock is free again, "taken" when someone else has it. */
  recovery: Extract<LockRecovery, "reacquire" | "taken">;
  busy?: boolean;
  /** Re-check out the now-free lock (only meaningful when `recovery` is "reacquire"). */
  onReacquire: () => void;
  /** Download the current diagram state as JSON. */
  onExport: () => void;
  /** Dismiss and continue in read-only mode. */
  onDismiss: () => void;
}

const primaryButton =
  "rounded-md border border-transparent bg-foreground px-3 py-1.5 text-xs font-medium text-surface transition hover:opacity-90 disabled:opacity-60";
const secondaryButton =
  "rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-background disabled:opacity-60";

/**
 * Recovery modal shown when the user's checkout lapses mid-edit (the 60-min TTL
 * expired and a poll no longer sees them as the holder). Offers re-checkout when
 * the lock is free, and always lets them rescue their work as JSON before
 * dropping to read-only.
 */
export function LockExpiryModal({
  recovery,
  busy = false,
  onReacquire,
  onExport,
  onDismiss,
}: LockExpiryModalProps) {
  const taken = recovery === "taken";

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4"
      onPointerDown={onDismiss}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="lock-expiry-title"
        onPointerDown={(e) => e.stopPropagation()}
        className="w-96 space-y-3 rounded-xl border border-border bg-surface p-5 shadow-lg"
      >
        <h2
          id="lock-expiry-title"
          className="text-base font-semibold text-status-broken"
        >
          Your checkout expired
        </h2>
        <p className="text-sm text-muted">
          {taken
            ? "Another user has since checked out this fridge, so editing is now read-only. Export your current work if you’d like to keep it."
            : "Your edit lock timed out after 60 minutes of inactivity. The fridge is free again — re-check out to keep editing, or export your current work."}
        </p>

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button type="button" onClick={onExport} className={secondaryButton}>
            Export as JSON
          </button>
          <button type="button" onClick={onDismiss} className={secondaryButton}>
            Continue read-only
          </button>
          {!taken ? (
            <button
              type="button"
              onClick={onReacquire}
              disabled={busy}
              className={primaryButton}
            >
              Re-check out
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
