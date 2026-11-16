import { describe, expect, it } from "vitest";
import {
  sampleWirePath,
  wireAppearance,
  WIRE_CONSTRUCTIONS,
} from "@/lib/diagram/wireAppearance";
import { wirePathsWithHops } from "@/lib/diagram/wires";

describe("wire route sampling", () => {
  it("preserves endpoints, bends, and distance with absolute and relative commands", () => {
    const samples = sampleWirePath("M 10 20 H 40 V 60 l 20 0 v -20 h 20")!;
    expect(samples[0]).toEqual({ x: 10, y: 20, distance: 0 });
    expect(samples.at(-1)).toEqual({ x: 80, y: 40, distance: 130 });
    expect(samples).toContainEqual({ x: 40, y: 20, distance: 30 });
    expect(
      samples.every((p, i) => i === 0 || p.distance > samples[i - 1].distance),
    ).toBe(true);
  });

  it.each([false, true])(
    "follows the actual router's crossing hop in either direction (reverse=%s)",
    (reverse) => {
      const points = reverse
        ? [
            { x: 100, y: 20 },
            { x: 0, y: 20 },
          ]
        : [
            { x: 0, y: 20 },
            { x: 100, y: 20 },
          ];
      const path = wirePathsWithHops(
        [{ key: "wire", points }],
        [{ a: { x: 50, y: 0 }, b: { x: 50, y: 40 } }],
      ).get("wire")!;
      const samples = sampleWirePath(path)!;
      expect(samples[0].x).toBe(points[0].x);
      expect(samples.at(-1)!.x).toBe(points[1].x);
      expect(Math.min(...samples.map((p) => p.y))).toBeCloseTo(14, 5);
      expect(Math.max(...samples.map((p) => p.y))).toBe(20);
      expect(samples.at(-1)!.distance).toBeCloseTo(88 + Math.PI * 6, 5);
    },
  );

  it("handles duplicate points and zero-length routes", () => {
    expect(sampleWirePath("M 4 8 L 4 8")).toEqual([]);
    const samples = sampleWirePath("M 0 0 L 0 0 H 20")!;
    expect(samples.at(-1)).toEqual({ x: 20, y: 0, distance: 20 });
  });

  it.each([
    "M 0",
    "M 0 0 Q 10 10 20 0",
    "M 0 0 M 20 0 L 30 0",
    "M 0 0 A 10 5 0 0 1 20 0",
    "L 10 20",
  ])("declines unsupported or incomplete geometry: %s", (path) => {
    expect(sampleWirePath(path)).toBeNull();
    expect(wireAppearance(path, "twisted_pair").strokes[0].d).toBe(path);
  });
});

describe("wire construction appearances", () => {
  const path = "M 10 20 L 100 20 L 100 80 L 180 80";

  it("gives every construction a distinct monochrome appearance", () => {
    const signatures = WIRE_CONSTRUCTIONS.map((construction) =>
      JSON.stringify(wireAppearance(path, construction)),
    );
    expect(new Set(signatures).size).toBe(WIRE_CONSTRUCTIONS.length);
  });

  it.each([
    "parallel_pair",
    "twisted_pair",
    "two_twisted_pairs",
    "ribbon",
  ] as const)(
    "keeps every %s strand anchored to the original ports",
    (construction) => {
      const appearance = wireAppearance(path, construction);
      const strands =
        construction === "ribbon"
          ? appearance.strokes.slice(2)
          : appearance.strokes;
      for (const stroke of strands) {
        const samples = sampleWirePath(stroke.d)!;
        expect(samples[0].x).toBe(10);
        expect(samples[0].y).toBe(20);
        expect(samples.at(-1)!.x).toBe(180);
        expect(samples.at(-1)!.y).toBe(80);
      }
    },
  );

  it.each(WIRE_CONSTRUCTIONS)(
    "produces finite geometry for a short reversed %s wire",
    (construction) => {
      const appearance = wireAppearance("M 10 10 L 8 10", construction);
      expect(appearance.strokes.length).toBeGreaterThan(0);
      for (const stroke of appearance.strokes)
        expect(stroke.d).not.toMatch(/NaN|Infinity/);
    },
  );

  it("retains the exact path of an unspecified wire", () => {
    expect(wireAppearance(path)).toEqual({
      strokes: [{ d: path, width: 2, background: false, dash: undefined }],
      width: 2,
    });
  });
});
