import { describe, it, expect } from "vitest";
import type { Lock } from "@/lib/types";
import { deriveLockState, lockExpiresAt, LOCK_TTL_MS } from "@/lib/locks/state";

const NOW = new Date("2026-06-22T12:00:00.000Z");
const future = new Date(NOW.getTime() + 10 * 60_000).toISOString();
const past = new Date(NOW.getTime() - 10 * 60_000).toISOString();

const makeLock = (overrides: Partial<Lock> = {}): Lock => ({
  fridge_id: "f1",
  locked_by: "me",
  locked_at: NOW.toISOString(),
  expires_at: future,
  ...overrides,
});

describe("lockExpiresAt", () => {
  it("is locked_at + 60 minutes", () => {
    expect(lockExpiresAt(NOW)).toBe(
      new Date(NOW.getTime() + LOCK_TTL_MS).toISOString(),
    );
  });
});

describe("deriveLockState", () => {
  it("is UNLOCKED with no lock", () => {
    expect(deriveLockState(null, "me", NOW)).toEqual({
      state: "UNLOCKED",
      holderId: null,
      lockedAt: null,
      expiresAt: null,
    });
  });

  it("is LOCKED_BY_ME for my active lock", () => {
    expect(deriveLockState(makeLock(), "me", NOW)).toEqual({
      state: "LOCKED_BY_ME",
      holderId: "me",
      lockedAt: NOW.toISOString(),
      expiresAt: future,
    });
  });

  it("is LOCKED_BY_OTHER for someone else's active lock", () => {
    expect(
      deriveLockState(makeLock({ locked_by: "alice" }), "me", NOW).state,
    ).toBe("LOCKED_BY_OTHER");
  });

  it("treats an expired lock as UNLOCKED — even my own", () => {
    expect(
      deriveLockState(makeLock({ expires_at: past }), "me", NOW).state,
    ).toBe("UNLOCKED");
    expect(
      deriveLockState(
        makeLock({ locked_by: "alice", expires_at: past }),
        "me",
        NOW,
      ).state,
    ).toBe("UNLOCKED");
  });
});
