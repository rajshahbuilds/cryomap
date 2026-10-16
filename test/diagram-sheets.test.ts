import { describe, it, expect } from "vitest";
import { assembleDiagram } from "@/lib/diagram/assemble";
import { fridgeSheet } from "@/lib/diagram/sheetService";
import { parseSnapshot, snapshotToState } from "@/lib/types";
import type { DiagramState } from "@/lib/types";
import { makeComponent, makeLine, makeSheet, makeStage } from "./fixtures";

const FRIDGE_SHEET = "00000000-0000-4000-8000-000000000002";
const ROOM_TEMP_SHEET = "00000000-0000-4000-8000-000000000003";

const sheets = [
  makeSheet({ id: FRIDGE_SHEET, kind: "fridge", sort_order: 0 }),
  makeSheet({
    id: ROOM_TEMP_SHEET,
    kind: "room_temp",
    name: "Input diagram",
    sort_order: 1,
  }),
];

function state(overrides: Partial<DiagramState> = {}): DiagramState {
  return {
    sheets,
    stages: [makeStage({ id: "mxc", sort_order: 0 })],
    lines: [makeLine({ id: "l2b", name: "2B", sort_order: 0 })],
    components: [],
    customDefs: [],
    connections: [],
    annotations: [],
    ...overrides,
  };
}

describe("fridgeSheet", () => {
  it("finds the one fridge-wiring sheet", () => {
    expect(fridgeSheet(sheets)?.id).toBe(FRIDGE_SHEET);
  });

  it("is null when a fridge has no sheets", () => {
    expect(fridgeSheet([])).toBeNull();
  });
});

describe("assembleDiagram sheet scoping", () => {
  const onFridge = makeComponent({ id: "att", sheet_id: FRIDGE_SHEET });
  const onBench = makeComponent({
    id: "siggen",
    sheet_id: ROOM_TEMP_SHEET,
    free_floating: true,
    line_id: null,
    stage_id: null,
    x_abs: 100,
    y_abs: 100,
  });

  it("renders only the requested sheet's components", () => {
    const s = state({ components: [onFridge, onBench] });

    expect(
      assembleDiagram(s, ROOM_TEMP_SHEET).components.map((c) => c.id),
    ).toEqual(["siggen"]);
    expect(
      assembleDiagram(s, FRIDGE_SHEET).components.map((c) => c.id),
    ).toEqual(["att"]);
  });

  it("defaults to the fridge sheet when no id is given", () => {
    const view = assembleDiagram(state({ components: [onFridge, onBench] }));
    expect(view.sheet?.id).toBe(FRIDGE_SHEET);
    expect(view.components.map((c) => c.id)).toEqual(["att"]);
  });

  it("falls back to the fridge sheet for an unknown sheet id", () => {
    const view = assembleDiagram(state(), "no-such-sheet");
    expect(view.sheet?.id).toBe(FRIDGE_SHEET);
  });

  it("hides stages and lines on a room-temp sheet, and flows horizontally", () => {
    const view = assembleDiagram(state(), ROOM_TEMP_SHEET);
    expect(view.stages).toEqual([]);
    expect(view.lines).toEqual([]);
    // No trunks means no implicit wires — only explicit connections are drawn.
    expect(view.wires).toEqual([]);
    expect(view.orientation).toBe("horizontal");
  });

  it("keeps stages and lines on the fridge sheet, and flows vertically", () => {
    const view = assembleDiagram(state(), FRIDGE_SHEET);
    expect(view.stages).toHaveLength(1);
    expect(view.lines).toHaveLength(1);
    expect(view.orientation).toBe("vertical");
  });

  it("exposes every sheet for the tab bar, in sort order", () => {
    expect(assembleDiagram(state()).sheets.map((s) => s.name)).toEqual([
      "Fridge wiring",
      "Input diagram",
    ]);
  });

  it("scopes explicit connections to the sheet", () => {
    const s = state({
      components: [onFridge, onBench],
      connections: [
        {
          id: "conn-bench",
          fridge_id: "00000000-0000-4000-8000-000000000001",
          sheet_id: ROOM_TEMP_SHEET,
          from_component_id: "siggen",
          from_port_side: "right",
          from_port_index: 0,
          to_component_id: "siggen",
          to_port_side: "left",
          to_port_index: 0,
          created_at: "2026-06-18T12:00:00.000Z",
        },
      ],
    });

    expect(assembleDiagram(s, FRIDGE_SHEET).connections).toEqual([]);
    expect(assembleDiagram(s, ROOM_TEMP_SHEET).connections).toHaveLength(1);
  });
});

describe("assembleDiagram pre-sheets back-compat", () => {
  // A restored version snapshot, or a fridge the backfill hasn't reached, has
  // no sheets and null sheet_ids. It is fridge wiring and must render whole —
  // filtering it away would preview an old version as a blank canvas.
  const legacy = state({
    sheets: [],
    components: [makeComponent({ id: "att", sheet_id: null })],
  });

  it("renders everything when there are no sheets at all", () => {
    const view = assembleDiagram(legacy);
    expect(view.sheet).toBeNull();
    expect(view.components.map((c) => c.id)).toEqual(["att"]);
    expect(view.stages).toHaveLength(1);
    expect(view.lines).toHaveLength(1);
  });

  it("treats a null sheet_id as belonging to the fridge sheet", () => {
    const s = state({
      components: [makeComponent({ id: "att", sheet_id: null })],
    });

    expect(
      assembleDiagram(s, FRIDGE_SHEET).components.map((c) => c.id),
    ).toEqual(["att"]);
    expect(assembleDiagram(s, ROOM_TEMP_SHEET).components).toEqual([]);
  });
});

describe("snapshot back-compat", () => {
  it("parses a pre-sheets snapshot and defaults `sheets` to empty", () => {
    // Captured shape from before sheets existed: no `sheets` key, no `sheet_id` on rows.
    const preSheets = {
      stages: [],
      lines: [],
      components: [
        {
          id: "00000000-0000-4000-8000-00000000000a",
          fridge_id: "00000000-0000-4000-8000-000000000001",
          line_id: null,
          stage_id: null,
          component_type: "attenuator",
          custom_def_id: null,
          label: null,
          value: "-20 dB",
          manufacturer: null,
          part_number: null,
          serial_number: null,
          frequency_range: null,
          power_rating: null,
          datasheet_url: null,
          notes: null,
          extra_fields: {},
          x_offset: 0,
          rotation: 0,
          free_floating: false,
          x_abs: null,
          y_abs: null,
          last_edited_by: null,
          last_edited_at: "2026-06-18T12:00:00.000Z",
          created_at: "2026-06-18T12:00:00.000Z",
        },
      ],
      custom_defs: [],
      snapshotted_at: "2026-06-18T12:00:00.000Z",
    };

    const snapshot = parseSnapshot(preSheets);
    expect(snapshot.sheets).toEqual([]);
    expect(snapshot.connections).toEqual([]);
    expect(snapshot.components[0].sheet_id).toBeNull();

    // …and it still renders, rather than resolving to a blank canvas.
    const view = assembleDiagram(snapshotToState(snapshot));
    expect(view.components).toHaveLength(1);
  });
});
