import { describe, it, expect } from "vitest";
import { matchingSignalPorts, signalPorts } from "@/lib/diagram/signals";
import { normalizeSignalPorts } from "@/lib/types/signalPorts";
import { assembleDiagram } from "@/lib/diagram/assemble";
import { serializeSnapshot, snapshotToState } from "@/lib/types";
import {
  makeComponent,
  makeDiagramState,
  makeLine,
  makeSheet,
  makeConnection,
} from "./fixtures";

const port = (id: string, label = "Q1", sheet_id = "bench") =>
  makeComponent({
    id,
    label,
    sheet_id,
    component_type: "input_port",
    free_floating: true,
    x_abs: 100,
    y_abs: 100,
  });
const state = () =>
  makeDiagramState({
    sheets: [
      makeSheet({ id: "cryo", kind: "fridge" }),
      makeSheet({ id: "bench", kind: "room_temp" }),
    ],
    lines: [makeLine({ id: "line", sheet_id: "cryo", name: "Q1" })],
    components: [
      port("a"),
      { ...port("b"), component_type: "output_port" },
      { ...port("c", "Q1", "cryo"), component_type: "bidir_port" },
    ],
  });

describe("named signals", () => {
  it("matches all directions on the same and different pages, including a line's default port", () => {
    expect(matchingSignalPorts(state(), "a").map((p) => p.id)).toEqual([
      "b",
      "c",
      "line",
    ]);
  });
  it("ignores blank names and case differences, trims surrounding spaces, and never links another fridge", () => {
    const s = state();
    s.components.push(
      port("spaces", " Q1 "),
      port("case", "q1"),
      port("empty", " "),
      port("empty2", ""),
      { ...port("foreign"), fridge_id: "other" },
    );
    expect(matchingSignalPorts(s, "a").map((p) => p.id)).toEqual([
      "b",
      "c",
      "spaces",
      "line",
    ]);
    expect(matchingSignalPorts(s, "empty")).toEqual([]);
    expect(matchingSignalPorts(s, "missing")).toEqual([]);
  });
  it("uses the owning line's current name and direction for persisted endpoints, without duplicates", () => {
    const s = state();
    s.components.push({
      ...port("saved", "stale", "cryo"),
      line_endpoint_id: "line",
    });
    s.lines[0].name = "Renamed";
    s.lines[0].direction = "output";
    expect(signalPorts(s).filter((p) => p.lineId)).toEqual([
      expect.objectContaining({
        id: "saved",
        name: "Renamed",
        componentType: "output_port",
      }),
    ]);
    expect(matchingSignalPorts(s, "a").map((p) => p.id)).not.toContain("saved");
    s.components[0].label = "Renamed";
    expect(matchingSignalPorts(s, "a").map((p) => p.id)).toEqual(["saved"]);
  });
  it("name matching neither creates wires nor changes stored connections", () => {
    const s = state();
    s.connections = [
      makeConnection({
        sheet_id: "bench",
        from_component_id: "a",
        from_port_side: "left",
        to_component_id: "b",
        to_port_side: "left",
      }),
    ];
    const before = structuredClone(s);
    const view = assembleDiagram(s, "bench");
    matchingSignalPorts(s, "a");
    expect(s).toEqual(before);
    expect(view.explicitWires).toHaveLength(1);
    expect(view.wires).toEqual([]);
    expect(view.lineWires).toEqual([]);
    s.components[1].label = "Different";
    expect(assembleDiagram(s, "bench").explicitWires).toHaveLength(1);
  });
  it("converts legacy Fridge Ports to Input using the old linked line's name, preserving cable endpoints and snapshots", () => {
    const s = state();
    s.components = [
      {
        ...port("old", "Old label"),
        component_type: "fridge_port",
        linked_line_id: "line",
      },
    ];
    const normalized = normalizeSignalPorts(s.components, s.lines);
    expect(normalized[0]).toMatchObject({
      id: "old",
      component_type: "input_port",
      label: "Q1",
      linked_line_id: null,
    });
    expect(s.components[0].component_type).toBe("fridge_port");
    expect(assembleDiagram(s, "bench").positioned[0].component).toEqual(
      normalized[0],
    );
    expect(snapshotToState(serializeSnapshot(s)).components).toEqual(
      normalized,
    );
    expect(matchingSignalPorts(s, "old").map((p) => p.id)).toEqual(["line"]);
  });
  it("preserves unlinked legacy port names and does not use a foreign fridge's line", () => {
    const legacy = {
      ...port("old", "Local"),
      component_type: "fridge_port" as const,
      linked_line_id: "line",
    };
    expect(
      normalizeSignalPorts(
        [legacy],
        [makeLine({ id: "line", name: "Foreign", fridge_id: "other" })],
      )[0].label,
    ).toBe("Local");
  });
});
