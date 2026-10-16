"use client";

import { useCallback, useEffect, useState } from "react";
import type { Lock } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { acquireLock, readLock, releaseLock } from "@/lib/locks/service";
import { deriveLockState, type LockStatus } from "@/lib/locks/state";

/** How often to re-check the lock from the server. */
const POLL_MS = 30_000;

export interface UseLockResult extends LockStatus {
  loading: boolean;
  isMine: boolean;
  /** Acquire (or refresh) the lock for the current user. */
  checkOut: () => Promise<void>;
  /** Release one's own lock. */
  release: () => Promise<void>;
  /** Release whoever currently holds the lock. */
  forceRelease: () => Promise<void>;
  /** Re-read the lock from the server. */
  refresh: () => Promise<void>;
}

/**
 * Lock/checkout state for a fridge: loads the lock, polls every 30s, and
 * exposes checkout / release / force-release. State is derived purely from the
 * lock row + the current user + the clock, so expired locks read as unlocked.
 */
export function useLock(
  fridgeId: string,
  currentUserId: string,
): UseLockResult {
  const [lock, setLock] = useState<Lock | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const db = createSupabaseBrowserClient();
    const current = await readLock(db, fridgeId);
    setLock(current);
    setLoading(false);
  }, [fridgeId]);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const db = createSupabaseBrowserClient();
        const current = await readLock(db, fridgeId);
        if (active) {
          setLock(current);
          setLoading(false);
        }
      } catch {
        if (active) setLoading(false);
      }
    })();

    const interval = setInterval(() => {
      void refresh();
    }, POLL_MS);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [fridgeId, refresh]);

  const checkOut = useCallback(async () => {
    const db = createSupabaseBrowserClient();
    await acquireLock(db, fridgeId, currentUserId);
    await refresh();
  }, [fridgeId, currentUserId, refresh]);

  const release = useCallback(async () => {
    const db = createSupabaseBrowserClient();
    await releaseLock(db, fridgeId);
    await refresh();
  }, [fridgeId, refresh]);

  const status = deriveLockState(lock, currentUserId);

  return {
    ...status,
    loading,
    isMine: status.state === "LOCKED_BY_ME",
    checkOut,
    release,
    // Force-release is the same delete; the UI gates who may trigger it.
    forceRelease: release,
    refresh,
  };
}
