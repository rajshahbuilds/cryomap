import { describe, it, expect } from "vitest";
import {
  componentsShiftedByReorder,
  componentsShiftedByResize,
  MIN_LINE_GAP,
  moveLine,
  nextLineSortOrder,
  resizeLineGap,
} from "@/lib/diagram/lineOps";
import { makeComponent, makeLine } from "./fixtures";

const lines = [
  makeLine({ id: "a", sort_order: 0 }),
  makeLine({ id: "b", sort_order: 1 }),
  makeLine({ id: "c", sort_order: 2 }),
];

// Default 120px gaps from the left gutter (200): trunks at a=320, b=440, c=560.

describe("nextLineSortOrder", () => {
  it("is one past the current max", () => {
    expect(nextLineSortOrder(lines)).toBe(3);
    expect(nextLineSortOrder([])).toBe(0);
  });
});

describe("moveLine", () => {
  it("swaps sort_order with the right neighbor", () => {
    expect(moveLine(lines, "a", "right")).toEqual([
      { id: "a", sort_order: 1 },
      { id: "b", sort_order: 0 },
    ]);
  });

  it("swaps sort_order with the left neighbor", () => {
    expect(moveLine(lines, "c", "left")).toEqual([
      { id: "c", sort_order: 1 },
      { id: "b", sort_order: 2 },
    ]);
  });

  it("is a no-op at the edges or for an unknown line", () => {
    expect(moveLine(lines, "a", "left")).toEqual([]);
    expect(moveLine(lines, "c", "right")).toEqual([]);
    expect(moveLine(lines, "missing", "left")).toEqual([]);
  });
});

describe("resizeLineGap", () => {
  it("snaps the dragged gap to the grid", () => {
    // prev trunk 200, pointer at 333 → gap 133 snapped to 140.
    expect(resizeLineGap(200, 333)).toBe(140);
  });

  it("clamps to the minimum gap so lines can't touch", () => {
    expect(resizeLineGap(200, 210)).toBe(MIN_LINE_GAP);
  });
});

describe("componentsShiftedByResize", () => {
  // Drag line b's trunk (old x 440) right by 60.
  const components = [
    makeComponent({ id: "left", x_abs: 320 }), // on a, left of the drag
    makeComponent({ id: "on", x_abs: 440 }), // on b
    makeComponent({ id: "between", x_abs: 500 }), // between b and c
    makeComponent({ id: "right", x_abs: 560 }), // on c
  ];

  it("shifts every component at or right of the dragged trunk by delta", () => {
    expect(componentsShiftedByResize(440, 60, components)).toEqual([
      { id: "on", before: 440, after: 500 },
      { id: "between", before: 500, after: 560 },
      { id: "right", before: 560, after: 620 },
    ]);
  });

  it("shifts left when the line is dragged left", () => {
    expect(componentsShiftedByResize(440, -40, components)).toEqual([
      { id: "on", before: 440, after: 400 },
      { id: "between", before: 500, after: 460 },
      { id: "right", before: 560, after: 520 },
    ]);
  });

  it("ignores attached, free-floating, and unpositioned components", () => {
    const skipped = [
      makeComponent({ id: "attached", x_abs: 560, line_id: "c" }),
      makeComponent({ id: "free", x_abs: 560, free_floating: true }),
      makeComponent({ id: "nox", x_abs: null }),
    ];
    expect(componentsShiftedByResize(440, 60, skipped)).toEqual([]);
  });

  it("is a no-op when the gap doesn't change", () => {
    expect(componentsShiftedByResize(440, 0, components)).toEqual([]);
  });
});

describe("componentsShiftedByReorder", () => {
  // Swap b and c: b 440→560, c 560→440; a is unchanged.
  const newLines = [
    makeLine({ id: "a", sort_order: 0 }),
    makeLine({ id: "b", sort_order: 2 }),
    makeLine({ id: "c", sort_order: 1 }),
  ];

  it("moves each swapped line's components to its new trunk x", () => {
    const components = [
      makeComponent({ id: "onA", x_abs: 320 }),
      makeComponent({ id: "onB", x_abs: 440 }),
      makeComponent({ id: "onC", x_abs: 560 }),
      makeComponent({ id: "between", x_abs: 500 }),
    ];
    expect(componentsShiftedByReorder(lines, newLines, components)).toEqual([
      { id: "onB", before: 440, after: 560 },
      { id: "onC", before: 560, after: 440 },
    ]);
  });
});
