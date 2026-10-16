import type { LockState } from "@/lib/locks/state";
import type { Version } from "@/lib/types";
import {
  componentCountLabel,
  latestVersionSummary,
  lockSummary,
} from "@/lib/diagram/status";

interface StatusBarProps {
  lockState: LockState;
  /** Display name of the lock holder (the current user, or another). */
  holderName: string | null;
  /** Human-readable time the lock was taken (e.g. "12:04 PM"). */
  since: string | null;
  /** Fridge versions, newest first (from `useVersions`). */
  versions: Version[];
  componentCount: number;
  zoomPercent: number;
}

const LOCK_DOT: Record<LockState, string> = {
  LOCKED_BY_ME: "bg-status-working",
  LOCKED_BY_OTHER: "bg-status-noisy",
  UNLOCKED: "bg-muted",
};

function Item({ children }: { children: React.ReactNode }) {
  return <span className="whitespace-nowrap">{children}</span>;
}

/**
 * Editor status bar: a thin, presentational strip summarizing the live lock,
 * the latest version, the component count, and the current zoom. All values are
 * derived by the pure helpers in `lib/diagram/status`.
 */
export function StatusBar({
  lockState,
  holderName,
  since,
  versions,
  componentCount,
  zoomPercent,
}: StatusBarProps) {
  const latest = latestVersionSummary(versions);

  return (
    <div className="flex items-center gap-4 border-t border-border bg-surface px-4 py-1 text-xs text-muted">
      <Item>
        <span
          aria-hidden="true"
          className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${LOCK_DOT[lockState]}`}
        />
        {lockSummary(lockState, holderName, since)}
      </Item>

      <span aria-hidden="true" className="text-border">
        |
      </span>

      <Item>
        {latest
          ? `Last version: ${latest.label}${latest.time ? ` · ${latest.time}` : ""}`
          : "No versions yet"}
      </Item>

      <div className="ml-auto flex items-center gap-4">
        <Item>{componentCountLabel(componentCount)}</Item>
        <Item>{zoomPercent}%</Item>
      </div>
    </div>
  );
}
