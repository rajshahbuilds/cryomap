import { describe, it, expect } from "vitest";
import { componentsInBox, toggleSelection } from "@/lib/diagram/selection";
import type { PositionedComponent } from "@/lib/diagram/assemble";
import { makeComponent } from "./fixtures";

describe("toggleSelection", () => {
  it("replaces the selection on a plain click", () => {
    expect(toggleSelection(["a", "b"], "c", false)).toEqual(["c"]);
  });

  it("adds and removes on an additive (shift) click", () => {
    expect(toggleSelection(["a"], "b", true)).toEqual(["a", "b"]);
    expect(toggleSelection(["a", "b"], "a", true)).toEqual(["b"]);
  });
});

describe("componentsInBox", () => {
  const positioned: PositionedComponent[] = [
    { component: makeComponent({ id: "in" }), x: 50, y: 50 },
    { component: makeComponent({ id: "out" }), x: 500, y: 500 },
  ];

  it("returns ids whose anchor is inside the box, regardless of corner order", () => {
    expect(
      componentsInBox(positioned, { x1: 100, y1: 100, x2: 0, y2: 0 }),
    ).toEqual(["in"]);
  });
});
