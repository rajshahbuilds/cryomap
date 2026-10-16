import { describe, it, expect } from "vitest";
import {
  boxesOverlap,
  componentBox,
  bandAtY,
  resolvePlacement,
  targetToPosition,
  type Box,
} from "@/lib/diagram/placement";
import { layoutStageBands } from "@/lib/diagram/stages";
import { makeLine, makeStage } from "./fixtures";

const SIZE = { width: 80, height: 40 };
// Bands: 300K → y 0..100, 4K → y 100..200; white space below 200.
const stages = [
  makeStage({ id: "s1", name: "300K", sort_order: 0, height_px: 100 }),
  makeStage({ id: "s2", name: "4K", sort_order: 1, height_px: 100 }),
];
// A single line: its trunk sits at LINE_AREA_LEFT(200) + width_px(120) = 320.
const lines = [makeLine({ id: "L1", sort_order: 0, width_px: 120 })];

describe("componentBox / boxesOverlap", () => {
  it("swaps width/height for a 90° rotation", () => {
    expect(componentBox({ x: 0, y: 0 }, SIZE, 90)).toMatchObject({
      width: 40,
      height: 80,
    });
  });

  it("treats touching edges as not overlapping", () => {
    const a: Box = { x: 0, y: 0, width: 80, height: 40 };
    expect(boxesOverlap(a, { x: 80, y: 0, width: 80, height: 40 })).toBe(false);
    expect(boxesOverlap(a, { x: 79, y: 0, width: 80, height: 40 })).toBe(true);
  });
});

describe("bandAtY", () => {
  const bands = layoutStageBands(stages);
  it("finds the band containing y, or null in white space", () => {
    expect(bandAtY(bands, 50)?.stage.id).toBe("s1");
    expect(bandAtY(bands, 140)?.stage.id).toBe("s2");
    expect(bandAtY(bands, 240)).toBeNull();
  });
});

describe("resolvePlacement", () => {
  it("pins to a stage (band-relative y) when dropped in a band", () => {
    const r = resolvePlacement({
      point: { x: 300, y: 140 },
      size: SIZE,
      rotation: 0,
      stages,
      obstacles: [],
    });
    expect(r.valid).toBe(true);
    expect(r.target).toEqual({
      kind: "stage",
      stageId: "s2",
      lineId: null,
      xAbs: 300,
      yOffset: 40, // snapped 140 minus band top 100
    });
  });

  it("allows any stage band — no temperature stage is disallowed", () => {
    const r = resolvePlacement({
      point: { x: 300, y: 40 }, // 300K band
      size: SIZE,
      rotation: 0,
      stages,
      obstacles: [],
    });
    expect(r.valid).toBe(true);
    expect(r.target).toMatchObject({ kind: "stage", stageId: "s1" });
  });

  it("places freely in the no-temperature white space", () => {
    const r = resolvePlacement({
      point: { x: 320, y: 240 },
      size: SIZE,
      rotation: 0,
      stages,
      obstacles: [],
    });
    expect(r.valid).toBe(true);
    expect(r.target).toEqual({
      kind: "free",
      lineId: null,
      xAbs: 320,
      yAbs: 240,
    });
  });

  it("rejects a drop that overlaps another component", () => {
    const r = resolvePlacement({
      point: { x: 300, y: 40 },
      size: SIZE,
      rotation: 0,
      stages,
      obstacles: [{ x: 300, y: 40, width: 80, height: 40 }],
    });
    expect(r.valid).toBe(false);
  });

  it("attaches to a nearby trunk and snaps x onto it", () => {
    const r = resolvePlacement({
      point: { x: 308, y: 140 }, // snaps to x 300, within 30 of the trunk at 320
      size: SIZE,
      rotation: 0,
      stages,
      lines,
      obstacles: [],
    });
    expect(r.x).toBe(320);
    expect(r.target).toMatchObject({
      kind: "stage",
      stageId: "s2",
      lineId: "L1",
      xAbs: 320,
    });
  });

  it("attaches a white-space drop to a nearby trunk", () => {
    const r = resolvePlacement({
      point: { x: 308, y: 240 }, // below all bands, near the trunk at 320
      size: SIZE,
      rotation: 0,
      stages,
      lines,
      obstacles: [],
    });
    expect(r.target).toMatchObject({ kind: "free", lineId: "L1", xAbs: 320 });
  });

  it("does not attach when the drop is far from any trunk", () => {
    const r = resolvePlacement({
      point: { x: 500, y: 140 }, // 180 from the only trunk
      size: SIZE,
      rotation: 0,
      stages,
      lines,
      obstacles: [],
    });
    expect(r.x).toBe(500);
    expect(r.target).toMatchObject({ lineId: null });
  });
});

describe("targetToPosition", () => {
  it("maps a stage target to pinned columns", () => {
    expect(
      targetToPosition({
        kind: "stage",
        stageId: "s1",
        lineId: null,
        xAbs: 100,
        yOffset: 20,
      }),
    ).toEqual({
      line_id: null,
      stage_id: "s1",
      free_floating: false,
      x_abs: 100,
      y_abs: 20,
    });
  });

  it("maps a free target to absolute columns with no stage", () => {
    expect(
      targetToPosition({ kind: "free", lineId: null, xAbs: 700, yAbs: 900 }),
    ).toEqual({
      line_id: null,
      stage_id: null,
      free_floating: true,
      x_abs: 700,
      y_abs: 900,
    });
  });

  it("carries the line id and pins a trunk-attached stage target", () => {
    expect(
      targetToPosition({
        kind: "stage",
        stageId: "s1",
        lineId: "L1",
        xAbs: 320,
        yOffset: 20,
      }),
    ).toMatchObject({ line_id: "L1", stage_id: "s1", free_floating: false });
  });

  it("anchors a trunk-attached free target to its line (not free-floating)", () => {
    expect(
      targetToPosition({ kind: "free", lineId: "L1", xAbs: 320, yAbs: 240 }),
    ).toEqual({
      line_id: "L1",
      stage_id: null,
      free_floating: false,
      x_abs: 320,
      y_abs: 240,
    });
  });
});
