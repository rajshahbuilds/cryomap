import { describe, it, expect } from "vitest";
import type { DiagramView } from "@/lib/diagram/assemble";
import type { Version } from "@/lib/types";
import {
  componentCount,
  componentCountLabel,
  latestVersionSummary,
  lockSummary,
  versionLabel,
  zoomPercent,
} from "@/lib/diagram/status";

const view = (count: number): DiagramView =>
  ({
    stages: [],
    lines: [],
    positioned: Array.from({ length: count }, (_, i) => ({
      component: { id: `c${i}` },
      x: 0,
      y: 0,
    })),
    wires: [],
    customDefById: new Map(),
  }) as unknown as DiagramView;

const version = (overrides: Partial<Version> = {}): Version =>
  ({
    id: "v1",
    fridge_id: "f1",
    snapshot: {} as never,
    commit_message: "msg",
    tag: null,
    snapshot_type: "current",
    author_id: "u1",
    author_name: "Ada",
    created_at: "2026-06-22T12:00:00.000Z",
    ...overrides,
  }) as Version;

describe("componentCount", () => {
  it("counts positioned components", () => {
    expect(componentCount(view(3))).toBe(3);
  });

  it("is zero for no view", () => {
    expect(componentCount(null)).toBe(0);
  });
});

describe("componentCountLabel", () => {
  it("pluralizes", () => {
    expect(componentCountLabel(0)).toBe("No components");
    expect(componentCountLabel(1)).toBe("1 component");
    expect(componentCountLabel(5)).toBe("5 components");
  });
});

describe("zoomPercent", () => {
  it("converts scale to a whole-number percentage", () => {
    expect(zoomPercent(1)).toBe(100);
    expect(zoomPercent(0.1)).toBe(10);
    expect(zoomPercent(4)).toBe(400);
  });

  it("rounds", () => {
    expect(zoomPercent(1.234)).toBe(123);
    expect(zoomPercent(0.756)).toBe(76);
  });
});

describe("versionLabel", () => {
  it("prefers the tag when present", () => {
    expect(versionLabel(version({ tag: "v2.0" }))).toBe("v2.0");
  });

  it("falls back to the snapshot type", () => {
    expect(versionLabel(version({ tag: null }))).toBe("current");
    expect(versionLabel(version({ tag: "  " }))).toBe("current");
    expect(versionLabel(version({ tag: null, snapshot_type: "planned" }))).toBe(
      "planned",
    );
  });
});

describe("latestVersionSummary", () => {
  it("is null when there are no versions", () => {
    expect(latestVersionSummary([])).toBeNull();
  });

  it("summarizes the first (newest) version", () => {
    const summary = latestVersionSummary([
      version({ tag: "rc1" }),
      version({ id: "v0", tag: "old" }),
    ]);
    expect(summary?.label).toBe("rc1");
    expect(summary?.time).toMatch(/\d/);
  });
});

describe("lockSummary", () => {
  it("describes the unlocked state", () => {
    expect(lockSummary("UNLOCKED", null, null)).toBe("Available to check out");
  });

  it("describes the user's own lock", () => {
    expect(lockSummary("LOCKED_BY_ME", "Me", "12:00 PM")).toBe(
      "Checked out by you",
    );
  });

  it("names the other holder, with and without a time", () => {
    expect(lockSummary("LOCKED_BY_OTHER", "Ada", "12:00 PM")).toBe(
      "Locked by Ada · 12:00 PM",
    );
    expect(lockSummary("LOCKED_BY_OTHER", "Ada", null)).toBe("Locked by Ada");
    expect(lockSummary("LOCKED_BY_OTHER", null, null)).toBe(
      "Locked by another user",
    );
  });
});
