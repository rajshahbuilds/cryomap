/**
 * Test fixtures producing full, valid table rows from `@/lib/types`.
 *
 * Factories return complete row objects (all columns) so they parse cleanly
 * against the canonical Zod schemas and can be composed into snapshots. Pass
 * `overrides` to set the fields a given test cares about.
 */
import type {
  Annotation,
  Component,
  Connection,
  CustomComponentDef,
  DiagramState,
  Fridge,
  Line,
  Sheet,
  Stage,
} from "@/lib/types";

const FRIDGE_ID = "00000000-0000-4000-8000-000000000001";
const SHEET_ID = "00000000-0000-4000-8000-000000000002";
const NOW = "2026-06-18T12:00:00.000Z";

const newId = () => crypto.randomUUID();

export function makeFridge(overrides: Partial<Fridge> = {}): Fridge {
  return {
    id: FRIDGE_ID,
    name: "DR-1",
    vendor: "Bluefors",
    model: "XLD",
    description: null,
    location: null,
    archived: false,
    workspace_id: null,
    created_by: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

export function makeAnnotation(
  overrides: Partial<Annotation> = {},
): Annotation {
  return {
    id: newId(),
    fridge_id: FRIDGE_ID,
    sheet_id: SHEET_ID,
    text: "note",
    x_abs: 100,
    y_abs: 100,
    created_by: null,
    created_at: NOW,
    ...overrides,
  };
}

/** A whole-fridge diagram state with every array empty unless overridden. */
export function makeDiagramState(
  overrides: Partial<DiagramState> = {},
): DiagramState {
  return {
    sheets: [],
    stages: [],
    lines: [],
    components: [],
    customDefs: [],
    connections: [],
    annotations: [],
    ...overrides,
  };
}

export function makeStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: newId(),
    fridge_id: FRIDGE_ID,
    sheet_id: SHEET_ID,
    name: "MXC",
    nominal_temp: "10 mK",
    color: null,
    sort_order: 0,
    height_px: 120,
    hidden: false,
    locked: false,
    ...overrides,
  };
}

export function makeLine(overrides: Partial<Line> = {}): Line {
  return {
    id: newId(),
    fridge_id: FRIDGE_ID,
    sheet_id: SHEET_ID,
    name: "Q1 XY drive",
    line_type: "xy_drive",
    direction: "input",
    status: "planned",
    notes: null,
    sort_order: 0,
    width_px: 120,
    show_label: true,
    created_at: NOW,
    ...overrides,
  };
}

export function makeComponent(overrides: Partial<Component> = {}): Component {
  return {
    id: newId(),
    fridge_id: FRIDGE_ID,
    sheet_id: SHEET_ID,
    line_id: null,
    stage_id: null,
    linked_line_id: null,
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
    mirrored: false,
    free_floating: false,
    x_abs: null,
    y_abs: null,
    last_edited_by: null,
    last_edited_at: NOW,
    created_at: NOW,
    ...overrides,
  };
}

export function makeCustomComponentDef(
  overrides: Partial<CustomComponentDef> = {},
): CustomComponentDef {
  return {
    id: newId(),
    fridge_id: FRIDGE_ID,
    name: "My splitter",
    width_px: 80,
    height_px: 40,
    ports: [
      { side: "left", index: 0 },
      { side: "right", index: 0 },
    ],
    extra_field_keys: null,
    created_by: null,
    created_at: NOW,
    ...overrides,
  };
}

export function makeSheet(overrides: Partial<Sheet> = {}): Sheet {
  return {
    id: SHEET_ID,
    fridge_id: FRIDGE_ID,
    kind: "fridge",
    name: "Fridge wiring",
    sort_order: 0,
    notes: null,
    created_at: NOW,
    ...overrides,
  };
}

export function makeConnection(
  overrides: Partial<Connection> = {},
): Connection {
  return {
    id: newId(),
    fridge_id: FRIDGE_ID,
    sheet_id: SHEET_ID,
    from_component_id: newId(),
    from_port_side: "right",
    from_port_index: 0,
    to_component_id: newId(),
    to_port_side: "left",
    to_port_index: 0,
    created_at: NOW,
    ...overrides,
  };
}
