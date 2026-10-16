import { describe, it, expect } from "vitest";
import {
  isPlacementAllowed,
  nearestLine,
  nearestStage,
  snapToIntersection,
} from "@/lib/diagram/snap";
import { lineColumnX } from "@/lib/diagram/lines";
import { getComponentDefinition } from "@/lib/constants/componentLibrary";
import { makeLine, makeStage } from "./fixtures";

const lines = [
  makeLine({ id: "lA", line_type: "xy_drive", sort_order: 0 }),
  makeLine({ id: "lB", line_type: "flux_z", sort_order: 1 }),
];
// Band centers: 300K → 60 (h120), 4K → 180 (h120 @ y120).
const stages = [
  makeStage({ id: "s1", name: "300K", sort_order: 0, height_px: 120 }),
  makeStage({ id: "s2", name: "4K", sort_order: 1, height_px: 120 }),
];

describe("nearestLine / nearestStage", () => {
  it("picks the closest column and band", () => {
    expect(nearestLine(lineColumnX(1) + 10, lines)?.id).toBe("lB");
    expect(nearestStage(175, stages)?.stage.id).toBe("s2");
  });

  it("returns null with no lines/stages", () => {
    expect(nearestLine(0, [])).toBeNull();
    expect(nearestStage(0, [])).toBeNull();
  });
});

describe("snapToIntersection", () => {
  it("snaps a point to the nearest line×stage intersection", () => {
    const target = snapToIntersection(
      { x: lineColumnX(0) + 5, y: 55 },
      lines,
      stages,
    );
    expect(target).toMatchObject({ x: lineColumnX(0), y: 60 });
    expect(target?.line.id).toBe("lA");
    expect(target?.stage.id).toBe("s1");
  });
});

describe("isPlacementAllowed", () => {
  it("allows unconstrained components anywhere", () => {
    const attenuator = getComponentDefinition("attenuator");
    expect(isPlacementAllowed(attenuator, lines[0])).toBe(true);
  });

  it("enforces allowedLineTypes", () => {
    // Thermometer is allowed only on a thermometry line.
    const thermometer = getComponentDefinition("thermometer");
    const thermoLine = makeLine({ id: "lt", line_type: "thermometry" });
    expect(isPlacementAllowed(thermometer, thermoLine)).toBe(true);
    expect(isPlacementAllowed(thermometer, lines[0])).toBe(false);
  });
});
