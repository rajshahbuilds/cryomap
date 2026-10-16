import { describe, it, expect } from "vitest";
import {
  diagramBounds,
  CONTENT_MARGIN,
  MIN_CANVAS_WIDTH,
  MIN_CANVAS_HEIGHT,
} from "@/lib/diagram/bounds";
import { LINE_AREA_LEFT } from "@/lib/diagram/lines";
import { makeLine, makeStage, makeComponent } from "./fixtures";

const view = (over: Partial<Parameters<typeof diagramBounds>[0]> = {}) => ({
  stages: [],
  lines: [],
  positioned: [],
  ...over,
});

describe("diagramBounds", () => {
  it("floors at the minimum for a near-empty fridge", () => {
    expect(diagramBounds(view())).toEqual({
      width: MIN_CANVAS_WIDTH,
      height: MIN_CANVAS_HEIGHT,
    });
  });

  it("grows to the rightmost trunk plus a margin", () => {
    const bounds = diagramBounds(
      view({ lines: [makeLine({ id: "a", sort_order: 0, width_px: 2000 })] }),
    );
    // Trunk x = gutter + gap = 200 + 2000 = 2200.
    expect(bounds.width).toBe(LINE_AREA_LEFT + 2000 + CONTENT_MARGIN);
  });

  it("grows to the stacked stage height plus a margin", () => {
    const bounds = diagramBounds(
      view({
        stages: [makeStage({ id: "s", sort_order: 0, height_px: 1000 })],
      }),
    );
    expect(bounds.height).toBe(1000 + CONTENT_MARGIN);
  });

  it("extends to fit a free-floating component", () => {
    const bounds = diagramBounds(
      view({ positioned: [{ component: makeComponent(), x: 3000, y: 1500 }] }),
    );
    expect(bounds.width).toBeGreaterThan(3000);
    expect(bounds.height).toBeGreaterThan(1500);
  });
});
