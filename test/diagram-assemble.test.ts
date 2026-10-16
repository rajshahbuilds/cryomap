import { describe, it, expect } from "vitest";
import type { DiagramState } from "@/lib/types";
import { assembleDiagram } from "@/lib/diagram/assemble";
import { lineColumnX } from "@/lib/diagram/lines";
import {
  makeAnnotation,
  makeComponent,
  makeConnection,
  makeCustomComponentDef,
  makeLine,
  makeSheet,
  makeStage,
} from "./fixtures";

// Two stages: band centers at 60 (300K, h120) and 170 (50K, h100 @ y120).
const stages = [
  makeStage({ id: "s1", name: "300K", sort_order: 0, height_px: 120 }),
  makeStage({ id: "s2", name: "50K", sort_order: 1, height_px: 100 }),
];
const lines = [
  makeLine({ id: "lA", sort_order: 0 }),
  makeLine({ id: "lB", sort_order: 1 }),
];

function build(
  components: DiagramState["components"],
  connections: DiagramState["connections"] = [],
): DiagramState {
  return {
    sheets: [],
    stages,
    lines,
    components,
    customDefs: [],
    connections,
    annotations: [],
  };
}

describe("assembleDiagram positioning", () => {
  it("anchors a placed component at lineColumnX × stage-band center", () => {
    const view = assembleDiagram(
      build([
        makeComponent({ id: "c1", line_id: "lA", stage_id: "s1" }),
        makeComponent({ id: "c2", line_id: "lB", stage_id: "s2" }),
      ]),
    );
    const byId = new Map(view.positioned.map((p) => [p.component.id, p]));
    expect(byId.get("c1")).toMatchObject({ x: lineColumnX(0), y: 60 });
    expect(byId.get("c2")).toMatchObject({ x: lineColumnX(1), y: 170 });
  });

  it("tracks the trunk x but keeps the band-relative y for a trunk-attached component", () => {
    // x comes from the line column (even with a stale x_abs), while y is
    // the band top (0) plus the stored offset, so the component follows the line.
    const view = assembleDiagram(
      build([
        makeComponent({
          id: "t",
          line_id: "lA",
          stage_id: "s1",
          x_abs: 9999, // stale; the live trunk x wins
          y_abs: 30,
        }),
      ]),
    );
    expect(view.positioned[0]).toMatchObject({ x: lineColumnX(0), y: 30 });
  });

  it("uses absolute coords for free-floating components", () => {
    const view = assembleDiagram(
      build([
        makeComponent({
          id: "f",
          free_floating: true,
          x_abs: 500,
          y_abs: 480,
        }),
      ]),
    );
    expect(view.positioned[0]).toMatchObject({ x: 500, y: 480 });
  });

  it("drops components that can't be placed", () => {
    const view = assembleDiagram(
      build([makeComponent({ id: "ghost", line_id: null, stage_id: null })]),
    );
    expect(view.positioned).toHaveLength(0);
  });
});

describe("assembleDiagram wiring", () => {
  it("connects adjacent components on the same line, not across lines", () => {
    const view = assembleDiagram(
      build([
        makeComponent({ id: "a0", line_id: "lA", stage_id: "s1" }),
        makeComponent({ id: "a1", line_id: "lA", stage_id: "s2" }),
        makeComponent({ id: "b0", line_id: "lB", stage_id: "s1" }),
      ]),
    );
    expect(view.wires.map((w) => w.key)).toEqual(["a0-a1"]);
    expect(view.wires[0].from).toEqual({ x: lineColumnX(0), y: 60 });
    expect(view.wires[0].to).toEqual({ x: lineColumnX(0), y: 170 });
  });

  it("does not wire free-floating components", () => {
    const view = assembleDiagram(
      build([
        makeComponent({ id: "f1", free_floating: true, x_abs: 0, y_abs: 0 }),
        makeComponent({ id: "f2", free_floating: true, x_abs: 0, y_abs: 50 }),
      ]),
    );
    expect(view.wires).toHaveLength(0);
  });

  it("resolves explicit connections to port-to-port segments", () => {
    // Attenuators (80×40) are drawn vertical (left/right-only ports
    // turn to top/bottom), so "right" faces down and "left" faces up — the port
    // sits half the box's *height* above/below the center.
    const view = assembleDiagram(
      build(
        [
          makeComponent({ id: "a", line_id: "lA", stage_id: "s1" }),
          makeComponent({ id: "b", line_id: "lB", stage_id: "s2" }),
        ],
        [
          makeConnection({
            from_component_id: "a",
            from_port_side: "right",
            to_component_id: "b",
            to_port_side: "left",
          }),
        ],
      ),
    );
    expect(view.explicitWires).toHaveLength(1);
    // a's right port faces down (center y 60 + halfHeight 40); b's left faces up.
    expect(view.explicitWires[0].from).toEqual({
      x: lineColumnX(0),
      y: 100,
    });
    expect(view.explicitWires[0].to).toEqual({
      x: lineColumnX(1),
      y: 130,
    });
  });

  it("exposes resolved port anchors for placed components", () => {
    const view = assembleDiagram(
      build([makeComponent({ id: "a", line_id: "lA", stage_id: "s1" })]),
    );
    const aPorts = view.portAnchors.filter((p) => p.componentId === "a");
    // attenuator → left(0) + right(0), anchored at the component's mid-sides.
    expect(aPorts.map((p) => p.port.side).sort()).toEqual(["left", "right"]);
    expect(aPorts).toHaveLength(2);
  });

  it("hops an explicit wire over a crossing implicit trunk (cross-layer)", () => {
    const x0 = lineColumnX(0);
    // Implicit trunk on line A runs vertically at x0 from y=60 to y=170. Two
    // free components sit either side of it so their connection runs horizontally
    // across the trunk at y=115 — a true crossing of two different wire layers.
    // Circulators keep their left/right ports (they have a bottom port too, so
    // no base turn), so the connection between them is genuinely horizontal.
    const view = assembleDiagram(
      build(
        [
          makeComponent({ id: "a0", line_id: "lA", stage_id: "s1" }),
          makeComponent({ id: "a1", line_id: "lA", stage_id: "s2" }),
          makeComponent({
            id: "fl",
            component_type: "circulator",
            free_floating: true,
            x_abs: x0 - 100,
            y_abs: 115,
          }),
          makeComponent({
            id: "fr",
            component_type: "circulator",
            free_floating: true,
            x_abs: x0 + 100,
            y_abs: 115,
          }),
        ],
        [
          makeConnection({
            from_component_id: "fl",
            from_port_side: "right",
            to_component_id: "fr",
            to_port_side: "left",
          }),
        ],
      ),
    );
    // The explicit wire carries a semicircular hop (arc) where it meets the trunk.
    expect(view.explicitWires[0].path).toContain("A 6 6");
    // The trunk itself stays straight (only horizontals hop).
    expect(view.wires[0].path).toBe(`M ${x0} 60 L ${x0} 170`);
  });

  it("drops connections whose endpoints can't be placed", () => {
    const view = assembleDiagram(
      build(
        [makeComponent({ id: "a", line_id: "lA", stage_id: "s1" })],
        [
          makeConnection({
            from_component_id: "a",
            to_component_id: "missing",
          }),
        ],
      ),
    );
    expect(view.explicitWires).toHaveLength(0);
  });
});

describe("assembleDiagram custom defs", () => {
  it("exposes a custom-definition lookup", () => {
    const def = makeCustomComponentDef({ id: "d1", name: "Splitter" });
    const view: ReturnType<typeof assembleDiagram> = assembleDiagram({
      sheets: [],
      stages,
      lines,
      components: [],
      customDefs: [def],
      connections: [],
      annotations: [],
    });
    expect(view.customDefById.get("d1")?.name).toBe("Splitter");
  });
});

describe("assembleDiagram lineNameById", () => {
  it("maps every fridge line by id → name across all sheets", () => {
    const fridgeSheet = makeSheet({ id: "f", sort_order: 0 });
    const rtSheet = makeSheet({ id: "rt", kind: "room_temp", sort_order: 1 });
    // Render the room-temp sheet, yet still resolve a fridge-sheet line's name.
    const view = assembleDiagram(
      {
        sheets: [fridgeSheet, rtSheet],
        stages: [],
        lines: [makeLine({ id: "l1", sheet_id: "f", name: "2B" })],
        components: [],
        customDefs: [],
        connections: [],
        annotations: [],
      },
      "rt",
    );
    expect(view.lines).toHaveLength(0); // the line isn't on this sheet…
    expect(view.lineNameById.get("l1")).toBe("2B"); // …but its name resolves
  });
});

describe("assembleDiagram annotations", () => {
  it("returns only the active sheet's annotations", () => {
    const s1 = makeSheet({ id: "sheet1", sort_order: 0 });
    const s2 = makeSheet({ id: "sheet2", kind: "room_temp", sort_order: 1 });
    const view = assembleDiagram(
      {
        sheets: [s1, s2],
        stages: [],
        lines: [],
        components: [],
        customDefs: [],
        connections: [],
        annotations: [
          makeAnnotation({ id: "n1", sheet_id: "sheet1" }),
          makeAnnotation({ id: "n2", sheet_id: "sheet2" }),
        ],
      },
      "sheet2",
    );
    expect(view.annotations.map((a) => a.id)).toEqual(["n2"]);
  });
});

describe("assembleDiagram crossing hops", () => {
  // Regression: a connection routed across another connection used to render a
  // flat four-way cross when it crossed exactly at a redundant collinear vertex
  // of the other wire (e.g. a port stub). Pruning collinear vertices makes the
  // crossing land in a segment interior so it hops. No trunk lines here, so the
  // only thing to hop over is the drop wire itself.
  it("hops where a connection crosses another connection's straight run", () => {
    const def50 = makeCustomComponentDef({ id: "r", name: "50Ohm" });
    const c = (o: Partial<Parameters<typeof makeComponent>[0]>) =>
      makeComponent({ stage_id: "mc", free_floating: false, ...o });
    const view = assembleDiagram({
      sheets: [],
      stages: [makeStage({ id: "mc", sort_order: 0, height_px: 1020 })],
      lines: [],
      components: [
        c({
          id: "att",
          component_type: "attenuator",
          x_abs: 660,
          y_abs: 460,
          // Stored 0° + base 90° → the right port faces down, as the
          // old explicit rotation: 90 did before left/right-only turns existed.
          rotation: 0,
        }),
        c({ id: "circ", component_type: "circulator", x_abs: 960, y_abs: 760 }),
        c({
          id: "coup",
          component_type: "directional_coupler",
          x_abs: 1220,
          y_abs: 760,
        }),
        c({
          id: "r1",
          component_type: "custom",
          custom_def_id: "r",
          x_abs: 960,
          y_abs: 880,
          rotation: 90,
        }),
      ],
      customDefs: [def50],
      connections: [
        makeConnection({
          id: "drop",
          from_component_id: "circ",
          from_port_side: "bottom",
          to_component_id: "r1",
          to_port_side: "left",
        }),
        makeConnection({
          id: "cross",
          from_component_id: "att",
          from_port_side: "right",
          to_component_id: "coup",
          to_port_side: "bottom",
        }),
      ],
      annotations: [],
    });
    const cross = view.explicitWires.find((w) => w.key === "cross");
    // The crossing wire arcs (hops) over the drop instead of crossing it flat.
    expect(cross?.path).toContain("A ");
    // And nothing reads as a connection at the crossing.
    expect(view.junctions).toEqual([]);
  });
});
