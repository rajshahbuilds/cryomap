import { describe, it, expect } from "vitest";
import type { Port } from "@/lib/types";
import {
  implicitWires,
  orthogonalPath,
  orthogonalRouteAvoiding,
  pruneCollinear,
  resolveExplicitWires,
  separateLanes,
  trunkCrossingVerticals,
  wireJunctions,
  wirePath,
  wirePathsWithHops,
  type ExplicitWire,
  type PlacedComponent,
} from "@/lib/diagram/wires";
import type { Box } from "@/lib/diagram/placement";

describe("wirePath", () => {
  it("draws a straight segment between two points", () => {
    expect(wirePath({ x: 10, y: 20 }, { x: 10, y: 80 })).toBe(
      "M 10 20 L 10 80",
    );
  });
});

describe("orthogonalPath", () => {
  // STUB = 16. Each end leaves its port in the side's facing direction first.
  it("leaves a left port leftward, so it doesn't cross under its component", () => {
    // left port at (200,0), target below-right — must exit to x<200 first.
    const path = orthogonalPath(
      { x: 200, y: 0 },
      { x: 260, y: 100 },
      "left",
      "top",
    );
    expect(path).toBe("M 200 0 L 184 0 L 184 84 L 260 84 L 260 100");
    // first leg goes left (x decreases), never back under the component
    expect(path).toContain("L 184 0");
  });

  it("leaves right/left ports outward and joins with a bend", () => {
    expect(
      orthogonalPath({ x: 0, y: 0 }, { x: 100, y: 40 }, "right", "left"),
    ).toBe("M 0 0 L 16 0 L 16 40 L 84 40 L 100 40");
  });

  it("leaves vertical ports up/down first", () => {
    expect(
      orthogonalPath({ x: 0, y: 0 }, { x: 40, y: 100 }, "bottom", "top"),
    ).toBe("M 0 0 L 0 16 L 40 16 L 40 84 L 40 100");
  });

  it("makes a clean single bend when the port faces toward the target", () => {
    // Left port with the target below-left: continue left then drop — no staircase.
    expect(
      orthogonalPath({ x: 618, y: 590 }, { x: 548, y: 738 }, "left", "top"),
    ).toBe("M 618 590 L 548 590 L 548 738");
  });

  it("keeps the perpendicular route when the target is behind the port", () => {
    // Left port with the target to the right must not double back under itself.
    expect(
      orthogonalPath({ x: 200, y: 0 }, { x: 260, y: 100 }, "left", "top"),
    ).toBe("M 200 0 L 184 0 L 184 84 L 260 84 L 260 100");
  });
});

describe("implicitWires", () => {
  const placed: PlacedComponent[] = [
    { id: "c2", lineId: "A", x: 100, y: 200 },
    { id: "c0", lineId: "A", x: 100, y: 50 },
    { id: "c1", lineId: "A", x: 100, y: 120 },
  ];

  it("connects adjacent components down a line in y order", () => {
    const wires = implicitWires(placed);
    expect(wires.map((w) => w.key)).toEqual(["c0-c1", "c1-c2"]);
    expect(wires[0].from).toEqual({ x: 100, y: 50 });
    expect(wires[0].to).toEqual({ x: 100, y: 120 });
  });

  it("never connects components across different lines", () => {
    const wires = implicitWires([
      { id: "a", lineId: "A", x: 0, y: 0 },
      { id: "b", lineId: "B", x: 50, y: 0 },
    ]);
    expect(wires).toHaveLength(0);
  });

  it("produces no wire for a lone component", () => {
    expect(implicitWires([{ id: "a", lineId: "A", x: 0, y: 0 }])).toHaveLength(
      0,
    );
  });

  it("routes a straight vertical when anchors share an x", () => {
    const [wire] = implicitWires([
      { id: "a", lineId: "A", x: 100, y: 0 },
      { id: "b", lineId: "A", x: 100, y: 100 },
    ]);
    expect(wire.points).toEqual([
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
    expect(wire.path).toBe("M 100 0 L 100 100");
  });

  it("jogs orthogonally (no diagonal) when anchors differ in x", () => {
    const [wire] = implicitWires([
      { id: "a", lineId: "A", x: 100, y: 0 },
      { id: "b", lineId: "A", x: 160, y: 100 },
    ]);
    // Z at the vertical midpoint (y=50) — only horizontal/vertical segments.
    expect(wire.points).toEqual([
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 160, y: 50 },
      { x: 160, y: 100 },
    ]);
    expect(wire.path).toBe("M 100 0 L 100 50 L 160 50 L 160 100");
  });
});

describe("wireJunctions", () => {
  it("does not short a wire that ends on another wire's span (overlap, not tap)", () => {
    // Connections are port-to-port; one wire ending mid-span of another is a
    // coincidental overlap, not a junction, so it gets no dot.
    const dots = wireJunctions([
      [
        { x: 0, y: 50 },
        { x: 50, y: 50 },
      ],
      [
        { x: 50, y: 0 },
        { x: 50, y: 100 },
      ],
    ]);
    expect(dots).toEqual([]);
  });

  it("does not short a wire passing through another wire's endpoint", () => {
    // The reported bug: a connection routed across a row of components passes
    // through each one's port (where that component's wire ends) — must not dot.
    const dots = wireJunctions([
      // A connection running straight across at y=50.
      [
        { x: 0, y: 50 },
        { x: 200, y: 50 },
      ],
      // A component's wire whose endpoint sits on that run at (100, 50).
      [
        { x: 100, y: 50 },
        { x: 100, y: 120 },
      ],
    ]);
    expect(dots).toEqual([]);
  });

  it("does not mark a plain crossover (no shared endpoint)", () => {
    const dots = wireJunctions([
      [
        { x: 0, y: 50 },
        { x: 100, y: 50 },
      ],
      [
        { x: 50, y: 0 },
        { x: 50, y: 100 },
      ],
    ]);
    expect(dots).toEqual([]);
  });

  it("does not mark a simple corner (one bent wire)", () => {
    const dots = wireJunctions([
      [
        { x: 0, y: 0 },
        { x: 0, y: 50 },
        { x: 50, y: 50 },
      ],
    ]);
    expect(dots).toEqual([]);
  });

  it("marks a star where three wires share an endpoint", () => {
    const dots = wireJunctions([
      [
        { x: 50, y: 50 },
        { x: 0, y: 50 },
      ],
      [
        { x: 50, y: 50 },
        { x: 100, y: 50 },
      ],
      [
        { x: 50, y: 50 },
        { x: 50, y: 100 },
      ],
    ]);
    expect(dots).toEqual([{ x: 50, y: 50 }]);
  });
});

describe("pruneCollinear", () => {
  it("collapses a straight run split by redundant vertices", () => {
    expect(
      pruneCollinear([
        { x: 960, y: 1910 },
        { x: 960, y: 1926 },
        { x: 960, y: 1944 },
        { x: 960, y: 1960 },
      ]),
    ).toEqual([
      { x: 960, y: 1910 },
      { x: 960, y: 1960 },
    ]);
  });

  it("keeps genuine corners and drops duplicate points", () => {
    expect(
      pruneCollinear([
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 50 },
        { x: 50, y: 50 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 50 },
      { x: 50, y: 50 },
    ]);
  });

  it("lets a wire hop a crossing that lands on a once-collinear vertex", () => {
    // Before pruning, the vertical's vertex at y=50 split it into two segments,
    // so a horizontal crossing exactly at y=50 fell in the gap and skipped its
    // hop. Pruned to a single segment, the crossing is interior and hops.
    const vertical = pruneCollinear([
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 50, y: 100 },
    ]);
    const paths = wirePathsWithHops([
      {
        key: "h",
        points: [
          { x: 0, y: 50 },
          { x: 100, y: 50 },
        ],
      },
      { key: "v", points: vertical },
    ]);
    expect(paths.get("h")).toContain("A ");
  });
});

describe("trunkCrossingVerticals", () => {
  it("spans the full y-range of the routes with slack", () => {
    const verticals = trunkCrossingVerticals(
      [320],
      [
        [
          { x: 0, y: 100 },
          { x: 500, y: 100 },
        ],
        [
          { x: 0, y: 400 },
          { x: 500, y: 400 },
        ],
      ],
    );
    expect(verticals).toEqual([
      { a: { x: 320, y: 99 }, b: { x: 320, y: 401 } },
    ]);
  });

  it("returns nothing when there are no routes to bound the span", () => {
    expect(trunkCrossingVerticals([100, 200], [])).toEqual([]);
  });
});

describe("wirePathsWithHops", () => {
  it("hops a horizontal wire over a crossing vertical wire", () => {
    const paths = wirePathsWithHops(
      [
        {
          key: "h",
          points: [
            { x: 0, y: 50 },
            { x: 100, y: 50 },
          ],
        },
        {
          key: "v",
          points: [
            { x: 50, y: 0 },
            { x: 50, y: 100 },
          ],
        },
      ],
      [],
      6,
    );
    // Horizontal wire gets a semicircular hop at x=50; vertical stays straight.
    expect(paths.get("h")).toBe("M 0 50 L 44 50 A 6 6 0 0 1 56 50 L 100 50");
    expect(paths.get("v")).toBe("M 50 0 L 50 100");
  });

  it("hops a horizontal wire over a trunk-line (extra) vertical", () => {
    const trunks = trunkCrossingVerticals(
      [50],
      [
        [
          { x: 0, y: 50 },
          { x: 100, y: 50 },
        ],
      ],
    );
    const paths = wirePathsWithHops(
      [
        {
          key: "h",
          points: [
            { x: 0, y: 50 },
            { x: 100, y: 50 },
          ],
        },
      ],
      trunks,
      6,
    );
    expect(paths.get("h")).toBe("M 0 50 L 44 50 A 6 6 0 0 1 56 50 L 100 50");
  });

  it("collapses a trunk line and a wire vertical at the same x to one hop", () => {
    const trunks = trunkCrossingVerticals(
      [50],
      [
        [
          { x: 0, y: 50 },
          { x: 100, y: 50 },
        ],
      ],
    );
    const paths = wirePathsWithHops(
      [
        {
          key: "h",
          points: [
            { x: 0, y: 50 },
            { x: 100, y: 50 },
          ],
        },
        {
          key: "v",
          points: [
            { x: 50, y: 0 },
            { x: 50, y: 100 },
          ],
        },
      ],
      trunks,
      6,
    );
    // One hop at x=50 despite both a wire vertical and a trunk crossing there.
    expect(paths.get("h")).toBe("M 0 50 L 44 50 A 6 6 0 0 1 56 50 L 100 50");
  });

  it("leaves non-crossing wires unchanged", () => {
    const paths = wirePathsWithHops([
      {
        key: "a",
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 100 },
        ],
      },
      {
        key: "b",
        points: [
          { x: 20, y: 0 },
          { x: 20, y: 100 },
        ],
      },
    ]);
    expect(paths.get("a")).toBe("M 0 0 L 0 100");
    expect(paths.get("b")).toBe("M 20 0 L 20 100");
  });

  it("does not hop at a shared endpoint (touching, not crossing)", () => {
    // vertical ends exactly at the horizontal's y — boundary, exclusive → no hop.
    const paths = wirePathsWithHops([
      {
        key: "h",
        points: [
          { x: 0, y: 50 },
          { x: 100, y: 50 },
        ],
      },
      {
        key: "v",
        points: [
          { x: 50, y: 50 },
          { x: 50, y: 100 },
        ],
      },
    ]);
    expect(paths.get("h")).toBe("M 0 50 L 100 50");
  });
});

describe("orthogonalRouteAvoiding", () => {
  it("returns the default route when there are no obstacles", () => {
    const route = orthogonalRouteAvoiding(
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      "right",
      "left",
      [],
    );
    expect(route).toEqual(
      orthogonalPathPoints({ x: 0, y: 0 }, { x: 100, y: 100 }),
    );
  });

  it("returns the default when the obstacle is off the route", () => {
    const box: Box = { x: 50, y: 500, width: 40, height: 40 };
    const route = orthogonalRouteAvoiding(
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      "right",
      "left",
      [box],
    );
    expect(route).toEqual(
      orthogonalPathPoints({ x: 0, y: 0 }, { x: 100, y: 100 }),
    );
  });

  it("routes around a component to reach a port on its far side", () => {
    // Target component spans x[100,160] y[-20,20] with a right-facing port at
    // (160,0). A straight run from the left would cross its body; it must not.
    const targetBox: Box = { x: 130, y: 0, width: 60, height: 40 };
    const route = orthogonalRouteAvoiding(
      { x: 0, y: 0 },
      { x: 160, y: 0 },
      "right",
      "right",
      [targetBox],
    );
    expect(route).toEqual([
      { x: 0, y: 0 },
      { x: 16, y: 0 },
      { x: 16, y: -21 },
      { x: 176, y: -21 },
      { x: 176, y: 0 },
      { x: 160, y: 0 },
    ]);
  });

  it("detours to an alternate route when the default hits an obstacle", () => {
    // Default routes vertically at x=16; this box sits on that leg.
    const box: Box = { x: 16, y: 50, width: 20, height: 20 };
    const route = orthogonalRouteAvoiding(
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      "right",
      "left",
      [box],
    );
    // Falls back to the horizontal-first L, which clears the box.
    expect(route).toEqual([
      { x: 0, y: 0 },
      { x: 84, y: 0 },
      { x: 84, y: 100 },
      { x: 100, y: 100 },
    ]);
  });
});

// Helper mirroring orthogonalRoute's output for the default-route assertions.
function orthogonalPathPoints(
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  return [
    from,
    { x: from.x + 16, y: from.y },
    { x: from.x + 16, y: to.y },
    { x: to.x - 16, y: to.y },
    to,
  ];
}

describe("separateLanes", () => {
  it("offsets two wires sharing a vertical channel onto separate lanes", () => {
    const [w1, w2] = separateLanes(
      [
        [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
          { x: 40, y: 50 },
          { x: 0, y: 50 },
        ],
        [
          { x: 80, y: 0 },
          { x: 40, y: 0 },
          { x: 40, y: 50 },
          { x: 80, y: 50 },
        ],
      ],
      8,
    );
    // The shared x=40 leg splits to x=36 / x=44; ports (first/last) never move.
    expect(w1).toEqual([
      { x: 0, y: 0 },
      { x: 36, y: 0 },
      { x: 36, y: 50 },
      { x: 0, y: 50 },
    ]);
    expect(w2).toEqual([
      { x: 80, y: 0 },
      { x: 44, y: 0 },
      { x: 44, y: 50 },
      { x: 80, y: 50 },
    ]);
  });

  it("leaves non-overlapping parallel wires untouched", () => {
    const routes = [
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 50 },
        { x: 0, y: 50 },
      ],
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 50 },
        { x: 0, y: 50 },
      ],
    ];
    expect(separateLanes(routes, 8)).toEqual(routes);
  });

  it("leaves a lone wire untouched", () => {
    const routes = [
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 50 },
        { x: 0, y: 50 },
      ],
    ];
    expect(separateLanes(routes, 8)).toEqual(routes);
  });
});

describe("resolveExplicitWires", () => {
  const port: Port = { side: "right", index: 0 };
  const wires: ExplicitWire[] = [
    {
      id: "w1",
      from: { componentId: "a", port },
      to: { componentId: "b", port },
    },
    {
      id: "w2",
      from: { componentId: "a", port },
      to: { componentId: "x", port },
    },
  ];

  it("resolves endpoints via the locator and drops unresolved wires", () => {
    const coords: Record<string, { x: number; y: number }> = {
      a: { x: 0, y: 0 },
      b: { x: 100, y: 0 },
    };
    const resolved = resolveExplicitWires(wires, (componentId) =>
      coords[componentId]
        ? { point: coords[componentId], side: "right" }
        : null,
    );
    expect(resolved.map((w) => w.key)).toEqual(["w1"]);
    expect(resolved[0].to).toEqual({ x: 100, y: 0 });
    // Resolved explicit wires carry a routed orthogonal path (see orthogonalPath).
    expect(resolved[0].path).toMatch(/^M 0 0 L/);
  });
});
