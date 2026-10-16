import type { Lock } from "@/lib/types";
import { isLockActive } from "./status";

/** Checkout lock lifetime: 60 minutes from `locked_at`. */
export const LOCK_TTL_MS = 60 * 60 * 1000;

/** ISO `expires_at` for a lock acquired at `now` (locked_at + 60 min). */
export function lockExpiresAt(now: Date = new Date()): string {
  return new Date(now.getTime() + LOCK_TTL_MS).toISOString();
}

export type LockState = "UNLOCKED" | "LOCKED_BY_ME" | "LOCKED_BY_OTHER";

export interface LockStatus {
  state: LockState;
  holderId: string | null;
  lockedAt: string | null;
  expiresAt: string | null;
}

/**
 * Derive the lock state for the current user from the lock row. A missing or
 * expired lock is UNLOCKED (60-min idle auto-release); otherwise the holder
 * decides MINE vs OTHER. Pure and clock-injected — the single source of truth
 * for every transition.
 */
export function deriveLockState(
  lock: Lock | null,
  currentUserId: string,
  now: Date = new Date(),
): LockStatus {
  if (!lock || !isLockActive(lock, now)) {
    return {
      state: "UNLOCKED",
      holderId: null,
      lockedAt: null,
      expiresAt: null,
    };
  }
  return {
    state:
      lock.locked_by === currentUserId ? "LOCKED_BY_ME" : "LOCKED_BY_OTHER",
    holderId: lock.locked_by,
    lockedAt: lock.locked_at,
    expiresAt: lock.expires_at,
  };
}

/** Recovery offered when a poll reveals the user's own lock vanished. */
export type LockRecovery = "none" | "reacquire" | "taken";

/**
 * Classify a lock-state transition for the recovery flow. When the user held
 * the lock and no longer does, they can re-acquire a now-free lock
 * (`reacquire`) or, if someone else grabbed it, only continue read-only
 * (`taken`). Any other transition needs no recovery. Intentional releases
 * (check-in / discard) are filtered out by the caller, not here.
 */
export function lockRecovery(prev: LockState, next: LockState): LockRecovery {
  if (prev !== "LOCKED_BY_ME" || next === "LOCKED_BY_ME") return "none";
  return next === "LOCKED_BY_OTHER" ? "taken" : "reacquire";
}
