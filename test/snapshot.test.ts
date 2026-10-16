import { describe, it, expect } from "vitest";
import {
  serializeSnapshot,
  parseSnapshot,
  snapshotToState,
  type DiagramState,
} from "@/lib/types";
import {
  makeStage,
  makeLine,
  makeComponent,
  makeCustomComponentDef,
} from "./fixtures";

function sampleState(): DiagramState {
  return {
    sheets: [],
    stages: [makeStage(), makeStage({ name: "4K", sort_order: 1 })],
    lines: [makeLine()],
    components: [makeComponent({ value: "-20 dB" })],
    customDefs: [makeCustomComponentDef()],
    connections: [],
    annotations: [],
  };
}

describe("snapshot serializer", () => {
  it("round-trips losslessly through serialize → parse", () => {
    const state = sampleState();
    const snapshot = serializeSnapshot(state, "2026-06-18T12:00:00.000Z");
    const parsed = parseSnapshot(snapshot);

    expect(parsed).toEqual(snapshot);
    expect(parsed.snapshotted_at).toBe("2026-06-18T12:00:00.000Z");
    expect(parsed.stages).toHaveLength(2);
    expect(parsed.custom_defs).toHaveLength(1);
  });

  it("round-trips state → snapshot → state", () => {
    const state = sampleState();
    const restored = snapshotToState(parseSnapshot(serializeSnapshot(state)));
    expect(restored).toEqual(state);
  });

  it("defaults snapshotted_at to an ISO timestamp", () => {
    const snapshot = serializeSnapshot({
      sheets: [],
      stages: [],
      lines: [],
      components: [],
      customDefs: [],
      connections: [],
      annotations: [],
    });
    expect(() => new Date(snapshot.snapshotted_at).toISOString()).not.toThrow();
  });

  it("rejects a snapshot missing required keys", () => {
    expect(() =>
      parseSnapshot({ stages: [], lines: [], components: [] }),
    ).toThrow();
  });

  it("defaults annotations to [] for pre-annotations snapshots", () => {
    // A snapshot written before annotations existed has no `annotations` key.
    const parsed = parseSnapshot({
      stages: [],
      lines: [],
      components: [],
      custom_defs: [],
      connections: [],
      snapshotted_at: "2026-06-18T12:00:00.000Z",
    });
    expect(parsed.annotations).toEqual([]);
    expect(snapshotToState(parsed).annotations).toEqual([]);
  });

  it("rejects a snapshot with malformed rows", () => {
    expect(() =>
      parseSnapshot({
        stages: [{ bad: true }],
        lines: [],
        components: [],
        custom_defs: [],
        snapshotted_at: "2026-06-18T12:00:00.000Z",
      }),
    ).toThrow();
  });
});
