import type { Lock } from "@/lib/types";
import { locksRepo, type Db } from "@/lib/repositories";
import { lockExpiresAt } from "./state";
import { isLockActive } from "./status";

/** Thrown when a checkout is refused because another user holds an active lock. */
export class LockConflictError extends Error {
  constructor(public readonly holderId: string | null) {
    super("This fridge is checked out by another user.");
    this.name = "LockConflictError";
  }
}

/** Read the current lock row for a fridge (or `null`). */
export async function readLock(db: Db, fridgeId: string): Promise<Lock | null> {
  return locksRepo(db).get(fridgeId);
}

/**
 * Check out: acquire/refresh the lock for the user with a 60-min expiry.
 *
 * Guards against stealing: if an *active* lock is held by someone else, this
 * throws {@link LockConflictError} rather than overwriting it, so a second tab
 * or concurrent user stays read-only and detects the lock from the DB. The user
 * may re-acquire their own lock (refresh) or any expired lock.
 */
export async function acquireLock(
  db: Db,
  fridgeId: string,
  userId: string,
  now: Date = new Date(),
): Promise<Lock> {
  const current = await readLock(db, fridgeId);
  if (current && isLockActive(current, now) && current.locked_by !== userId) {
    throw new LockConflictError(current.locked_by);
  }
  return locksRepo(db).acquire({
    fridge_id: fridgeId,
    locked_by: userId,
    expires_at: lockExpiresAt(now),
  });
}

/**
 * Release the lock for a fridge by deleting the row. Used for check-in/release
 * of one's own lock and for force-releasing another user's lock alike.
 */
export async function releaseLock(db: Db, fridgeId: string): Promise<void> {
  return locksRepo(db).release(fridgeId);
}
