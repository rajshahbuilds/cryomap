import { describe, it, expect } from "vitest";
import {
  moveStage,
  nextStageSortOrder,
  resizeStageHeight,
  MIN_STAGE_HEIGHT,
} from "@/lib/diagram/stageOps";
import { makeStage } from "./fixtures";

const stages = [
  makeStage({ id: "a", sort_order: 0 }),
  makeStage({ id: "b", sort_order: 1 }),
  makeStage({ id: "c", sort_order: 2 }),
];

describe("nextStageSortOrder", () => {
  it("is one past the current max", () => {
    expect(nextStageSortOrder(stages)).toBe(3);
    expect(nextStageSortOrder([])).toBe(0);
  });
});

describe("moveStage", () => {
  it("swaps sort_order with the neighbor above/below", () => {
    expect(moveStage(stages, "a", "down")).toEqual([
      { id: "a", sort_order: 1 },
      { id: "b", sort_order: 0 },
    ]);
    expect(moveStage(stages, "c", "up")).toEqual([
      { id: "c", sort_order: 1 },
      { id: "b", sort_order: 2 },
    ]);
  });

  it("is a no-op at the edges or for an unknown stage", () => {
    expect(moveStage(stages, "a", "up")).toEqual([]);
    expect(moveStage(stages, "c", "down")).toEqual([]);
    expect(moveStage(stages, "missing", "up")).toEqual([]);
  });
});

describe("resizeStageHeight", () => {
  it("snaps the dragged height to the grid", () => {
    // band top 100, drag bottom to 233 → height 133 → snapped to 140
    expect(resizeStageHeight(100, 233)).toBe(140);
  });

  it("clamps to the minimum", () => {
    expect(resizeStageHeight(100, 110)).toBe(MIN_STAGE_HEIGHT);
  });
});
