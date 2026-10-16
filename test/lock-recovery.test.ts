import { describe, it, expect } from "vitest";
import { lockRecovery } from "@/lib/locks/state";
import { exportFilename } from "@/lib/diagram/exportJson";

describe("lockRecovery", () => {
  it("offers re-checkout when my lock lapsed and the fridge is free", () => {
    expect(lockRecovery("LOCKED_BY_ME", "UNLOCKED")).toBe("reacquire");
  });

  it("offers read-only when someone else grabbed it", () => {
    expect(lockRecovery("LOCKED_BY_ME", "LOCKED_BY_OTHER")).toBe("taken");
  });

  it("does nothing while I still hold the lock", () => {
    expect(lockRecovery("LOCKED_BY_ME", "LOCKED_BY_ME")).toBe("none");
  });

  it("does nothing for transitions that don't start from my lock", () => {
    expect(lockRecovery("UNLOCKED", "LOCKED_BY_ME")).toBe("none");
    expect(lockRecovery("LOCKED_BY_OTHER", "UNLOCKED")).toBe("none");
    expect(lockRecovery("UNLOCKED", "LOCKED_BY_OTHER")).toBe("none");
  });
});

describe("exportFilename", () => {
  const date = new Date("2026-06-22T15:30:00.000Z");

  it("slugifies the fridge name and appends the date", () => {
    expect(exportFilename("Bluefors XLD #2", "json", date)).toBe(
      "bluefors-xld-2-2026-06-22.json",
    );
  });

  it("falls back to 'diagram' for empty/missing names", () => {
    expect(exportFilename(null, "json", date)).toBe("diagram-2026-06-22.json");
    expect(exportFilename("   ", "json", date)).toBe("diagram-2026-06-22.json");
    expect(exportFilename("!!!", "json", date)).toBe("diagram-2026-06-22.json");
  });

  it("honors a custom extension for image exports", () => {
    expect(exportFilename("Bluefors XLD #2", "png", date)).toBe(
      "bluefors-xld-2-2026-06-22.png",
    );
    expect(exportFilename("Bluefors XLD #2", "pdf", date)).toBe(
      "bluefors-xld-2-2026-06-22.pdf",
    );
  });
});
