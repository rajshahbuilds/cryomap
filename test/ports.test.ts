import { describe, it, expect } from "vitest";
import type { Port } from "@/lib/types";
import {
  effectiveSide,
  localPortPositions,
  portPositions,
  rotatePoint,
} from "@/lib/diagram/ports";

const INLINE_2: Port[] = [
  { side: "left", index: 0 },
  { side: "right", index: 0 },
];

describe("portPositions mirroring", () => {
  const size = { width: 80, height: 40 };

  it("flips port x when mirrored (left↔right positions swap)", () => {
    const normal = portPositions(INLINE_2, size, 0, false);
    const mirrored = portPositions(INLINE_2, size, 0, true);
    // left port local x = -40 → +40 when mirrored; right port +40 → -40.
    expect(normal.map((p) => p.x)).toEqual([-40, 40]);
    expect(mirrored.map((p) => p.x)).toEqual([40, -40]);
    // y is unchanged by a horizontal mirror.
    expect(mirrored.map((p) => p.y)).toEqual(normal.map((p) => p.y));
  });
});

describe("effectiveSide", () => {
  it("is unchanged with no rotation or mirror", () => {
    expect(effectiveSide("left", 0, false)).toBe("left");
    expect(effectiveSide("top", 0, false)).toBe("top");
  });

  it("flips left↔right when mirrored", () => {
    expect(effectiveSide("left", 0, true)).toBe("right");
    expect(effectiveSide("right", 0, true)).toBe("left");
    expect(effectiveSide("top", 0, true)).toBe("top");
  });

  it("maps sides through clockwise rotation", () => {
    expect(effectiveSide("left", 90, false)).toBe("top");
    expect(effectiveSide("right", 180, false)).toBe("left");
    expect(effectiveSide("top", 270, false)).toBe("left");
  });

  it("applies the mirror before the rotation", () => {
    // mirror left→right, then rotate 90° clockwise: right→bottom.
    expect(effectiveSide("left", 90, true)).toBe("bottom");
  });
});

describe("rotatePoint", () => {
  const p = { x: 10, y: 4 };
  it("is identity at 0°", () => {
    expect(rotatePoint(p, 0)).toEqual({ x: 10, y: 4 });
  });
  it("matches SVG rotate at 90/180/270", () => {
    expect(rotatePoint(p, 90)).toEqual({ x: -4, y: 10 });
    expect(rotatePoint(p, 180)).toEqual({ x: -10, y: -4 });
    expect(rotatePoint(p, 270)).toEqual({ x: 4, y: -10 });
  });
});

describe("localPortPositions", () => {
  it("places a lone left/right port at the side midpoint", () => {
    const placed = localPortPositions(INLINE_2, { width: 80, height: 40 });
    expect(placed.map((p) => ({ x: p.x, y: p.y }))).toEqual([
      { x: -40, y: 0 },
      { x: 40, y: 0 },
    ]);
  });

  it("distributes multiple ports evenly along a side", () => {
    const ports: Port[] = [
      { side: "left", index: 0 },
      { side: "right", index: 0 },
      { side: "right", index: 1 },
    ];
    const placed = localPortPositions(ports, { width: 70, height: 60 });
    const right = placed.filter((p) => p.port.side === "right");
    expect(right.map((p) => p.y)).toEqual([-10, 10]);
    expect(right.every((p) => p.x === 35)).toBe(true);
  });

  it("pushes ports outward by the lead length along each side's normal", () => {
    const ports: Port[] = [
      { side: "left", index: 0 },
      { side: "right", index: 0 },
      { side: "top", index: 0 },
      { side: "bottom", index: 0 },
    ];
    const placed = localPortPositions(ports, { width: 80, height: 40 }, 10);
    expect(placed.map((p) => ({ x: p.x, y: p.y }))).toEqual([
      { x: -50, y: 0 }, // left: -40 - 10
      { x: 50, y: 0 }, // right: 40 + 10
      { x: 0, y: -30 }, // top: -20 - 10
      { x: 0, y: 30 }, // bottom: 20 + 10
    ]);
  });

  it("leaves the on-side coordinate unchanged when extending the lead", () => {
    const ports: Port[] = [
      { side: "left", index: 0 },
      { side: "left", index: 1 },
    ];
    const plain = localPortPositions(ports, { width: 80, height: 60 });
    const extended = localPortPositions(ports, { width: 80, height: 60 }, 10);
    expect(extended.map((p) => p.y)).toEqual(plain.map((p) => p.y));
    expect(extended.every((p) => p.x === -50)).toBe(true);
  });
});

describe("portPositions", () => {
  it("rotates the local positions", () => {
    const placed = portPositions(INLINE_2, { width: 80, height: 40 }, 90);
    // left (-40,0) → (0, -40); right (40,0) → (0, 40)
    expect(placed[0].x).toBeCloseTo(0);
    expect(placed[0].y).toBeCloseTo(-40);
    expect(placed[1].x).toBeCloseTo(0);
    expect(placed[1].y).toBeCloseTo(40);
  });
});
