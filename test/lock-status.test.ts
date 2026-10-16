import { describe, it, expect } from "vitest";
import type { Lock } from "@/lib/types";
import { isLockActive } from "@/lib/locks/status";

const makeLock = (overrides: Partial<Lock> = {}): Lock => ({
  fridge_id: "f1",
  locked_by: "u1",
  locked_at: "2026-06-18T12:00:00.000Z",
  expires_at: "2026-06-18T13:00:00.000Z",
  ...overrides,
});

describe("isLockActive", () => {
  const now = new Date("2026-06-18T12:30:00.000Z");

  it("is inactive when there is no lock", () => {
    expect(isLockActive(null, now)).toBe(false);
  });

  it("is active before expiry", () => {
    expect(isLockActive(makeLock(), now)).toBe(true);
  });

  it("is inactive once expired", () => {
    expect(
      isLockActive(makeLock({ expires_at: "2026-06-18T12:00:00.000Z" }), now),
    ).toBe(false);
  });

  it("treats a null expiry as active", () => {
    expect(isLockActive(makeLock({ expires_at: null }), now)).toBe(true);
  });
});
