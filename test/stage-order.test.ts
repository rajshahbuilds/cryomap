import { describe, it, expect } from "vitest";
import {
  parseTemperatureK,
  planStageInsertion,
  stageInsertionIndex,
} from "@/lib/diagram/stageOrder";
import { makeStage } from "./fixtures";

describe("parseTemperatureK", () => {
  it("parses kelvin and milli/micro/nano kelvin", () => {
    expect(parseTemperatureK("300 K")).toBe(300);
    expect(parseTemperatureK("4 K")).toBe(4);
    expect(parseTemperatureK("700 mK")).toBeCloseTo(0.7);
    expect(parseTemperatureK("10 mK")).toBeCloseTo(0.01);
    expect(parseTemperatureK("50 µK")).toBeCloseTo(5e-5);
    expect(parseTemperatureK("2 nK")).toBeCloseTo(2e-9);
  });

  it("tolerates qualifiers, decimals, and missing spaces", () => {
    expect(parseTemperatureK("~700 mK")).toBeCloseTo(0.7);
    expect(parseTemperatureK("1.5 K")).toBeCloseTo(1.5);
    expect(parseTemperatureK("300K")).toBe(300);
  });

  it("returns null for non-temperatures", () => {
    expect(parseTemperatureK("device")).toBeNull();
    expect(parseTemperatureK("")).toBeNull();
    expect(parseTemperatureK(null)).toBeNull();
  });
});

// A typical fridge stack, top (hot) → bottom (cold).
const stack = () => [
  makeStage({ id: "300k", nominal_temp: "300 K", sort_order: 0 }),
  makeStage({ id: "50k", nominal_temp: "50 K", sort_order: 1 }),
  makeStage({ id: "4k", nominal_temp: "4 K", sort_order: 2 }),
  makeStage({ id: "mxc", nominal_temp: "~10 mK", sort_order: 3 }),
  makeStage({ id: "sample", nominal_temp: "device", sort_order: 4 }),
];

describe("stageInsertionIndex", () => {
  it("places a hotter stage at the very top", () => {
    expect(stageInsertionIndex(stack(), "600 K")).toBe(0);
  });

  it("slots a stage between hotter and colder neighbors", () => {
    expect(stageInsertionIndex(stack(), "20 K")).toBe(2); // between 50K and 4K
    expect(stageInsertionIndex(stack(), "1 K")).toBe(3); // between 4K and 10mK
  });

  it("puts a colder stage above the unsortable 'device' stage", () => {
    expect(stageInsertionIndex(stack(), "1 mK")).toBe(4);
  });

  it("appends a stage with no temperature at the bottom", () => {
    expect(stageInsertionIndex(stack(), null)).toBe(5);
    expect(stageInsertionIndex(stack(), "heater")).toBe(5);
  });
});

describe("planStageInsertion", () => {
  it("inserting at the top renumbers everything below it", () => {
    const plan = planStageInsertion(stack(), "600 K");
    expect(plan.newSortOrder).toBe(0);
    expect(plan.shifted).toEqual([
      { id: "300k", sort_order: 1 },
      { id: "50k", sort_order: 2 },
      { id: "4k", sort_order: 3 },
      { id: "mxc", sort_order: 4 },
      { id: "sample", sort_order: 5 },
    ]);
  });

  it("inserting in the middle only shifts the stages below the gap", () => {
    const plan = planStageInsertion(stack(), "20 K");
    expect(plan.newSortOrder).toBe(2);
    expect(plan.shifted).toEqual([
      { id: "4k", sort_order: 3 },
      { id: "mxc", sort_order: 4 },
      { id: "sample", sort_order: 5 },
    ]);
  });

  it("appending at the bottom shifts nothing", () => {
    const plan = planStageInsertion(stack(), null);
    expect(plan.newSortOrder).toBe(5);
    expect(plan.shifted).toEqual([]);
  });
});
