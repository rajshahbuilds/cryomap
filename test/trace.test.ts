import { describe, it, expect } from "vitest";
import type { Component, Connection, DiagramState } from "@/lib/types";
import { assembleDiagram } from "@/lib/diagram/assemble";
import {
  traceChain,
  chainsByLine,
  tracedChainsForLine,
  lineComponents,
  hopLabel,
} from "@/lib/diagram/trace";
import {
  makeComponent,
  makeConnection,
  makeLine,
  makeSheet,
  makeStage,
} from "./fixtures";

const RT = "rt-sheet";

function port(id: string, linkedLineId: string | null): Component {
  return makeComponent({
    id,
    sheet_id: RT,
    component_type: "fridge_port",
    linked_line_id: linkedLineId,
    free_floating: true,
    x_abs: 0,
    y_abs: 0,
  });
}

function box(id: string, label: string): Component {
  return makeComponent({
    id,
    sheet_id: RT,
    component_type: "attenuator",
    label,
    value: null,
    free_floating: true,
    x_abs: 0,
    y_abs: 0,
  });
}

function wire(from: string, to: string): Connection {
  return makeConnection({
    sheet_id: RT,
    from_component_id: from,
    to_component_id: to,
  });
}

/** Assemble a single room-temp sheet holding these components + connections. */
function view(components: Component[], connections: Connection[]) {
  const state: DiagramState = {
    sheets: [makeSheet({ id: RT, kind: "room_temp" })],
    stages: [],
    lines: [],
    components,
    customDefs: [],
    connections,
    annotations: [],
  };
  return assembleDiagram(state, RT);
}

describe("traceChain", () => {
  it("orders a linear chain source → endpoint and marks it oriented", () => {
    const v = view(
      [box("A", "SigGen"), box("B", "Filter"), port("P", "L1")],
      [wire("A", "B"), wire("B", "P")],
    );
    const chain = traceChain(v, { componentId: "P" });
    expect(chain.hops.map((c) => c.id)).toEqual(["A", "B"]);
    expect(chain.lineId).toBe("L1");
    expect(chain.oriented).toBe(true);
  });

  it("handles a fan-out through a splitter (unoriented, terminates)", () => {
    const v = view(
      [
        box("A", "SrcA"),
        box("B", "SrcB"),
        box("S", "Splitter"),
        port("P", "L1"),
      ],
      [wire("S", "P"), wire("S", "A"), wire("S", "B")],
    );
    const chain = traceChain(v, { componentId: "P" });
    expect(new Set(chain.hops.map((c) => c.id))).toEqual(
      new Set(["A", "B", "S"]),
    );
    expect(chain.oriented).toBe(false);
  });

  it("handles a fan-in through a combiner (unoriented)", () => {
    const v = view(
      [
        box("A", "SrcA"),
        box("B", "SrcB"),
        box("C", "Combiner"),
        port("P", "L1"),
      ],
      [wire("A", "C"), wire("B", "C"), wire("C", "P")],
    );
    const chain = traceChain(v, { componentId: "P" });
    expect(chain.hops).toHaveLength(3);
    expect(chain.oriented).toBe(false);
  });

  it("terminates on a cycle and reports it unoriented", () => {
    const v = view(
      [box("A", "A"), box("B", "B"), box("C", "C"), port("P", "L1")],
      [wire("A", "B"), wire("B", "C"), wire("C", "A"), wire("C", "P")],
    );
    const chain = traceChain(v, { componentId: "P" });
    // All three boxes are reachable; the walk doesn't loop forever.
    expect(chain.hops).toHaveLength(3);
    expect(chain.oriented).toBe(false);
  });

  it("returns an empty, oriented chain for a disconnected endpoint", () => {
    const v = view([port("P", "L1")], []);
    const chain = traceChain(v, { componentId: "P" });
    expect(chain.hops).toEqual([]);
    expect(chain.lineId).toBe("L1");
    expect(chain.oriented).toBe(true);
  });
});

describe("chainsByLine", () => {
  const state = (
    components: Component[],
    connections: Connection[],
  ): DiagramState => ({
    sheets: [makeSheet({ id: RT, kind: "room_temp" })],
    stages: [],
    lines: [],
    components,
    customDefs: [],
    connections,
    annotations: [],
  });

  it("groups two chains that terminate at the same line", () => {
    const map = chainsByLine(
      state(
        [box("A1", "A1"), port("P1", "L1"), box("A2", "A2"), port("P2", "L1")],
        [wire("A1", "P1"), wire("A2", "P2")],
      ),
    );
    expect(map.get("L1")).toHaveLength(2);
  });

  it("keys distinct lines separately and skips unlinked ports", () => {
    const map = chainsByLine(
      state(
        [box("A", "A"), port("P1", "L1"), port("P2", "L2"), port("P3", null)],
        [wire("A", "P1")],
      ),
    );
    expect(map.get("L1")).toHaveLength(1);
    expect(map.get("L2")).toHaveLength(1);
    expect([...map.keys()].sort()).toEqual(["L1", "L2"]);
  });
});

describe("tracedChainsForLine", () => {
  const state = (
    components: Component[],
    connections: Connection[],
  ): DiagramState => ({
    sheets: [makeSheet({ id: RT, kind: "room_temp" })],
    stages: [],
    lines: [],
    components,
    customDefs: [],
    connections,
    annotations: [],
  });

  it("returns only the chains linked to the given line", () => {
    const s = state(
      [box("A", "A"), port("P1", "L1"), box("B", "B"), port("P2", "L2")],
      [wire("A", "P1"), wire("B", "P2")],
    );
    const l1 = tracedChainsForLine(s, "L1");
    expect(l1).toHaveLength(1);
    expect(l1[0].hops.map((c) => c.id)).toEqual(["A"]);
    expect(tracedChainsForLine(s, "L2")).toHaveLength(1);
    expect(tracedChainsForLine(s, "nope")).toEqual([]);
  });
});

describe("lineComponents", () => {
  const FRIDGE = "fridge-sheet";
  // Warmest stage first (sort_order 0 = top).
  const stages = [
    makeStage({ id: "st300", sheet_id: FRIDGE, name: "300K", sort_order: 0 }),
    makeStage({ id: "st4", sheet_id: FRIDGE, name: "4K", sort_order: 1 }),
    makeStage({ id: "stmxc", sheet_id: FRIDGE, name: "MXC", sort_order: 2 }),
  ];
  const onLine = (id: string, stageId: string, y = 0) =>
    makeComponent({
      id,
      sheet_id: FRIDGE,
      component_type: "attenuator",
      line_id: "L1",
      stage_id: stageId,
      free_floating: false,
      x_abs: 0,
      y_abs: y,
    });

  const state = (components: Component[]): DiagramState => ({
    sheets: [makeSheet({ id: FRIDGE, kind: "fridge" })],
    stages,
    lines: [makeLine({ id: "L1", sheet_id: FRIDGE, name: "2B" })],
    components,
    customDefs: [],
    connections: [],
    annotations: [],
  });

  it("orders line components warm → cold by stage, then by y within a band", () => {
    const s = state([
      onLine("cold", "stmxc"),
      onLine("warm", "st300"),
      onLine("mid-low", "st4", 90),
      onLine("mid-high", "st4", 10),
    ]);
    expect(lineComponents(s, "L1").map((c) => c.id)).toEqual([
      "warm",
      "mid-high",
      "mid-low",
      "cold",
    ]);
  });

  it("excludes other lines and free-floating components", () => {
    const s = state([
      onLine("on", "st300"),
      makeComponent({
        id: "other-line",
        sheet_id: FRIDGE,
        line_id: "L2",
        stage_id: "st300",
        free_floating: false,
      }),
      makeComponent({
        id: "floating",
        sheet_id: FRIDGE,
        line_id: "L1",
        stage_id: null,
        free_floating: true,
      }),
    ]);
    expect(lineComponents(s, "L1").map((c) => c.id)).toEqual(["on"]);
  });

  it("continues a bench chain down the linked line's stages", () => {
    const s = state([
      onLine("att4K", "st4"),
      onLine("attMXC", "stmxc"),
      // A room-temp bench (sheet RT) driving the line via a linked port.
      box("Src", "Src"),
      port("P", "L1"),
    ]);
    s.sheets = [
      makeSheet({ id: FRIDGE, kind: "fridge", sort_order: 0 }),
      makeSheet({ id: RT, kind: "room_temp", sort_order: 1 }),
    ];
    s.connections = [wire("Src", "P")];
    const [chain] = tracedChainsForLine(s, "L1");
    expect(chain.hops.map((c) => c.id)).toEqual(["Src"]);
    expect(chain.fridge.map((c) => c.id)).toEqual(["att4K", "attMXC"]);
  });
});

describe("hopLabel", () => {
  it("uses the instance label and appends a value when present", () => {
    expect(hopLabel(box("A", "SigGen"))).toBe("SigGen");
    expect(hopLabel(makeComponent({ label: "Att", value: "-20 dB" }))).toBe(
      "Att (-20 dB)",
    );
  });

  it("falls back to the built-in type label, then a custom def name", () => {
    expect(
      hopLabel(
        makeComponent({ label: null, value: null, component_type: "mixer" }),
      ),
    ).toBe("Mixer");
    expect(
      hopLabel(
        makeComponent({ label: null, value: null, component_type: "custom" }),
        "My Splitter",
      ),
    ).toBe("My Splitter");
  });
});
