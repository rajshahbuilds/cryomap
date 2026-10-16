import type { Lock } from "@/lib/types";

/** Presentational lock state for a fridge, as rendered by FridgeCard. */
export interface FridgeLockView {
  active: boolean;
  holderName: string | null;
}

/**
 * Whether a lock is currently held. Per the domain rules, a lock expires at
 * `expires_at` (locked_at + 60 min) and an expired lock counts as unlocked. A
 * missing lock is unlocked; a lock with no expiry is treated as active.
 */
export function isLockActive(
  lock: Lock | null,
  now: Date = new Date(),
): boolean {
  if (!lock) return false;
  if (!lock.expires_at) return true;
  return new Date(lock.expires_at).getTime() > now.getTime();
}
