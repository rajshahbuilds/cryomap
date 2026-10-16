import { describe, it, expect } from "vitest";
import {
  acquireLock,
  LockConflictError,
  readLock,
  releaseLock,
} from "@/lib/locks/service";
import { deriveLockState, LOCK_TTL_MS } from "@/lib/locks/state";
import type { Db } from "@/lib/repositories";
import { createSupabaseFake, type SupabaseFake } from "./supabase-fake";

const asDb = (fake: SupabaseFake) => fake as unknown as Db;
const F = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-06-22T12:00:00.000Z");
const LATER = new Date(NOW.getTime() + LOCK_TTL_MS + 1);

describe("lock service", () => {
  it("checkout upserts a lock with the holder and a 60-min expiry", async () => {
    const fake = createSupabaseFake();
    const lock = await acquireLock(asDb(fake), F, "user-1", NOW);

    expect(lock.locked_by).toBe("user-1");
    expect(lock.expires_at).toBe(
      new Date(NOW.getTime() + LOCK_TTL_MS).toISOString(),
    );
    expect(fake.tables.locks).toHaveLength(1);
    expect(deriveLockState(lock, "user-1", NOW).state).toBe("LOCKED_BY_ME");
  });

  it("keeps one lock row per fridge when the holder refreshes", async () => {
    const fake = createSupabaseFake();
    await acquireLock(asDb(fake), F, "user-1", NOW);
    await acquireLock(asDb(fake), F, "user-1", NOW);

    expect(fake.tables.locks).toHaveLength(1);
    expect((await readLock(asDb(fake), F))?.locked_by).toBe("user-1");
  });

  it("refuses to steal an active lock held by another user", async () => {
    const fake = createSupabaseFake();
    await acquireLock(asDb(fake), F, "user-1", NOW);

    await expect(acquireLock(asDb(fake), F, "user-2", NOW)).rejects.toThrow(
      LockConflictError,
    );
    // The original holder is untouched, so the second user stays read-only.
    expect((await readLock(asDb(fake), F))?.locked_by).toBe("user-1");
  });

  it("lets another user take over an expired lock", async () => {
    const fake = createSupabaseFake();
    await acquireLock(asDb(fake), F, "user-1", NOW);

    const taken = await acquireLock(asDb(fake), F, "user-2", LATER);
    expect(taken.locked_by).toBe("user-2");
    expect(fake.tables.locks).toHaveLength(1);
  });

  it("release/force-release deletes the lock regardless of holder", async () => {
    const fake = createSupabaseFake();
    await acquireLock(asDb(fake), F, "alice", NOW);

    // Anyone may delete the row (force release).
    await releaseLock(asDb(fake), F);

    expect(fake.tables.locks).toHaveLength(0);
    expect(await readLock(asDb(fake), F)).toBeNull();
  });
});
