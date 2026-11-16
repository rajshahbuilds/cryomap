import { describe, it, expect } from "vitest";
import { assembleDiagram } from "@/lib/diagram/assemble";
import { parseSnapshot, serializeSnapshot, snapshotToState } from "@/lib/types";
import {
  makeComponent,
  makeDiagramState,
  makeLine,
  makeStage,
  makeConnection,
} from "./fixtures";

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
  it("leaves every aligned component unwired until a cable is manually placed", () => {
    const view = assembleDiagram(state());
    expect(view.lineWires).toEqual([]);
    expect(view.wires).toEqual([]);
    expect(view.explicitWires).toEqual([]);
  });
  it("does not render legacy entry-wire properties as a connection", () => {
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
    expect(assembleDiagram(configured).lineWires).toEqual([]);
    expect(
      assembleDiagram({ ...configured, components: [sample, bottom] })
        .lineWires,
    ).toEqual([]);
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
  it("loads historical snapshots without generating wires", () => {
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
