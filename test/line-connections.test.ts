import { describe, it, expect } from "vitest";
import {
  lineConnectionPorts,
  LINE_ENDPOINT_Y,
} from "@/lib/diagram/lineConnections";
import { assembleDiagram } from "@/lib/diagram/assemble";
import { lineColumnX } from "@/lib/diagram/lines";
import { parseSnapshot, serializeSnapshot, snapshotToState } from "@/lib/types";
import {
  makeComponent,
  makeCustomComponentDef,
  makeDiagramState,
  makeLine,
  makeStage,
  makeConnection,
} from "./fixtures";

const left = { side: "left", index: 0 } as const;
const right = { side: "right", index: 0 } as const;
describe("line connection ports", () => {
  it("uses the top and bottom ports of a simple inline component", () => {
    expect(lineConnectionPorts(makeComponent())).toEqual({
      entry: left,
      exit: right,
    });
    expect(lineConnectionPorts(makeComponent({ mirrored: true }))).toEqual({
      entry: right,
      exit: left,
    });
  });
  it("requires a choice when a rotated inline component no longer faces along the line", () => {
    expect(lineConnectionPorts(makeComponent({ rotation: 90 }))).toEqual({
      entry: null,
      exit: null,
    });
  });
  it.each(["dut", "termination", "thermometer"] as const)(
    "ends the chain at a single-port %s",
    (component_type) => {
      const resolved = lineConnectionPorts(makeComponent({ component_type }));
      expect(resolved.entry).not.toBeNull();
      expect(resolved.exit).toBeNull();
    },
  );
  it("requires explicit choices for a device with branch ports", () => {
    expect(
      lineConnectionPorts(makeComponent({ component_type: "circulator" })),
    ).toEqual({ entry: null, exit: null });
    expect(
      lineConnectionPorts(
        makeComponent({
          component_type: "circulator",
          line_entry_port: left,
          line_exit_port: right,
        }),
      ),
    ).toEqual({ entry: left, exit: right });
  });
  it("keeps chosen local identities when rotating and mirroring", () => {
    expect(
      lineConnectionPorts(
        makeComponent({
          rotation: 90,
          mirrored: true,
          line_entry_port: left,
          line_exit_port: right,
        }),
      ),
    ).toEqual({ entry: left, exit: right });
  });
  it("does not invent a port after a custom definition changes", () => {
    const def = makeCustomComponentDef({ ports: [left, right] });
    expect(
      lineConnectionPorts(
        makeComponent({
          component_type: "custom",
          line_entry_port: { side: "top", index: 4 },
        }),
        def,
      ).entry,
    ).toBeNull();
  });
  it("never reuses a single terminal for entry and exit", () => {
    expect(
      lineConnectionPorts(
        makeComponent({ component_type: "termination", line_exit_port: left }),
      ),
    ).toEqual({ entry: null, exit: left });
  });
});

const line = makeLine();
const stages = [
  makeStage({ sort_order: 0, height_px: 180 }),
  makeStage({ sort_order: 1, height_px: 180 }),
  makeStage({ sort_order: 2, height_px: 180 }),
];
const top = makeComponent({ line_id: line.id, stage_id: stages[0].id });
const sample = makeComponent({
  line_id: line.id,
  stage_id: stages[1].id,
  component_type: "dut",
});
const bottom = makeComponent({ line_id: line.id, stage_id: stages[2].id });
const state = () =>
  makeDiagramState({
    lines: [line],
    stages,
    components: [top, sample, bottom],
  });
describe("line endpoint wiring", () => {
  it("connects the boundary to the first real port and ends at Sample", () => {
    const view = assembleDiagram(state());
    expect(view.lineWires).toHaveLength(1);
    expect(view.lineWires[0].from).toEqual({
      x: lineColumnX(0),
      y: LINE_ENDPOINT_Y,
    });
    expect(view.lineWires[0].to).toEqual({ x: lineColumnX(0), y: 50 });
    expect(view.wires).toHaveLength(1);
    expect(view.wires[0].from).toEqual({ x: lineColumnX(0), y: 130 });
    expect(view.wires[0].to).toEqual({ x: lineColumnX(0), y: 240 });
    expect(view.wires[0].toComponentId).toBe(sample.id);
  });
  it("attaches the same editable entry properties when its first component changes", () => {
    const entry = {
      ...line.entry_wire_properties,
      construction: "coaxial" as const,
      label: "Entry feed",
      datasheet_url: "https://example.com/feed.pdf",
    };
    const configured = {
      ...state(),
      lines: [{ ...line, entry_wire_properties: entry }],
    };
    const original = assembleDiagram(configured).lineWires[0];
    const changed = assembleDiagram({
      ...configured,
      components: [sample, bottom],
    }).lineWires[0];
    expect(original.reference).toEqual({ kind: "line_entry", id: line.id });
    expect(original.properties).toEqual(entry);
    expect(changed.properties).toEqual(entry);
    expect(changed.toComponentId).toBe(sample.id);
  });
  it("leaves an empty line with just its endpoint", () => {
    const view = assembleDiagram({ ...state(), components: [] });
    expect(view.lineWires).toEqual([]);
    expect(view.wires).toEqual([]);
  });
  it("does not reuse a port occupied by an explicit cable", () => {
    const view = assembleDiagram({
      ...state(),
      connections: [
        makeConnection({
          from_component_id: top.id,
          from_port_side: "right",
          to_component_id: sample.id,
          to_port_side: "top",
        }),
      ],
    });
    expect(view.wires).toEqual([]);
    expect(view.explicitWires).toHaveLength(1);
  });
  it("keeps geometry independent of input, output, and bidirectional signal flow", () => {
    const base = assembleDiagram(state());
    for (const direction of ["output", "bidirectional"] as const) {
      const view = assembleDiagram({
        ...state(),
        lines: [{ ...line, direction }],
      });
      expect(view.lineWires).toEqual(base.lineWires);
      expect(view.wires).toEqual(base.wires);
    }
  });
  it("does not hop over an empty placement column", () => {
    const view = assembleDiagram({
      ...state(),
      components: [
        makeComponent({
          id: "a",
          component_type: "circulator",
          free_floating: true,
          x_abs: 220,
          y_abs: 300,
        }),
        makeComponent({
          id: "b",
          component_type: "circulator",
          free_floating: true,
          x_abs: 420,
          y_abs: 300,
        }),
      ],
      connections: [
        makeConnection({
          from_component_id: "a",
          from_port_side: "right",
          to_component_id: "b",
          to_port_side: "left",
        }),
      ],
    });
    expect(view.explicitWires[0].path).not.toContain("A 6 6");
  });
  it("loads historical snapshots with Input and automatic port defaults", () => {
    const snapshot = JSON.parse(JSON.stringify(serializeSnapshot(state())));
    snapshot.lines[0].direction = null;
    delete snapshot.components[0].line_entry_port;
    delete snapshot.components[0].line_exit_port;
    for (const restored of [
      snapshotToState(snapshot),
      snapshotToState(parseSnapshot(snapshot)),
    ]) {
      expect(restored.lines[0].direction).toBe("input");
      expect(restored.components[0].line_entry_port).toBeNull();
      expect(restored.components[0].line_exit_port).toBeNull();
    }
  });
});
