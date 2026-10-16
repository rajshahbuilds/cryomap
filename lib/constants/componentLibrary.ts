import type {
  BuiltInComponentType,
  LineType,
  Port,
  SheetKind,
} from "@/lib/types";
import { BUILT_IN_COMPONENT_TYPES } from "@/lib/types";

/**
 * Built-in component definitions — the metadata that drives the palette and
 * canvas placement. The actual SVG glyph for each type is rendered by
 * `ComponentSymbol`, keyed by `type`; this module owns everything
 * else: label, category, ports, default size, placement constraints, and the
 * fields pre-filled when an instance is dropped.
 */

export const COMPONENT_CATEGORIES = [
  "passive",
  "active",
  "source",
  "instrument",
  "microwave",
  "connector",
  "io",
  "fridge",
] as const;
export type ComponentCategory = (typeof COMPONENT_CATEGORIES)[number];

export interface BuiltInComponentDefinition {
  type: BuiltInComponentType;
  label: string;
  category: ComponentCategory;
  /** Which sheet kinds this component belongs on — drives the palette. */
  sheetKinds: SheetKind[];
  /** Connection ports, in symbol-local coordinates (see `Port`). */
  ports: Port[];
  defaultSize: { width: number; height: number };
  /** Line types this component makes sense on; `null` = any line type. */
  allowedLineTypes: LineType[] | null;
  /** Fields pre-filled on a freshly placed instance. */
  defaultFields: { value?: string; label?: string };
}

// Sheet-kind availability ---------------------------------------------------
const BOTH: SheetKind[] = ["fridge", "room_temp"];
const FRIDGE: SheetKind[] = ["fridge"];
const ROOM_TEMP: SheetKind[] = ["room_temp"];

// Common port layouts ------------------------------------------------------
const INLINE_2: Port[] = [
  { side: "left", index: 0 },
  { side: "right", index: 0 },
];
const SINGLE_LEFT: Port[] = [{ side: "left", index: 0 }];

export const COMPONENT_LIBRARY: Record<
  BuiltInComponentType,
  BuiltInComponentDefinition
> = {
  attenuator: {
    type: "attenuator",
    sheetKinds: BOTH,
    label: "Attenuator",
    category: "passive",
    ports: INLINE_2,
    defaultSize: { width: 80, height: 80 },
    allowedLineTypes: null,
    defaultFields: { value: "-20 dB" },
  },
  filter_lp: {
    type: "filter_lp",
    sheetKinds: BOTH,
    label: "Low-pass Filter",
    category: "passive",
    ports: INLINE_2,
    defaultSize: { width: 80, height: 80 },
    allowedLineTypes: null,
    defaultFields: {},
  },
  filter_hp: {
    type: "filter_hp",
    sheetKinds: BOTH,
    label: "High-pass Filter",
    category: "passive",
    ports: INLINE_2,
    defaultSize: { width: 80, height: 80 },
    allowedLineTypes: null,
    defaultFields: {},
  },
  filter_bp: {
    type: "filter_bp",
    sheetKinds: BOTH,
    label: "Band-pass Filter",
    category: "passive",
    ports: INLINE_2,
    defaultSize: { width: 80, height: 80 },
    allowedLineTypes: null,
    defaultFields: {},
  },
  dc_block: {
    type: "dc_block",
    sheetKinds: BOTH,
    label: "DC Block",
    category: "passive",
    ports: INLINE_2,
    defaultSize: { width: 60, height: 60 },
    allowedLineTypes: null,
    defaultFields: {},
  },
  feedthrough: {
    type: "feedthrough",
    sheetKinds: BOTH,
    label: "Feedthrough",
    category: "connector",
    ports: INLINE_2,
    defaultSize: { width: 60, height: 60 },
    allowedLineTypes: null,
    defaultFields: {},
  },
  amplifier_hemt: {
    type: "amplifier_hemt",
    sheetKinds: FRIDGE,
    label: "HEMT Amplifier",
    category: "active",
    ports: INLINE_2,
    defaultSize: { width: 70, height: 70 },
    allowedLineTypes: null,
    defaultFields: { value: "+40 dB" },
  },
  amplifier_roomtemp: {
    type: "amplifier_roomtemp",
    sheetKinds: BOTH,
    label: "Room-temp Amplifier",
    category: "active",
    ports: INLINE_2,
    defaultSize: { width: 70, height: 70 },
    allowedLineTypes: null,
    defaultFields: { value: "+30 dB" },
  },
  amplifier_parametric: {
    type: "amplifier_parametric",
    sheetKinds: FRIDGE,
    label: "Parametric Amplifier",
    category: "active",
    ports: INLINE_2,
    defaultSize: { width: 70, height: 70 },
    allowedLineTypes: null,
    defaultFields: {},
  },
  circulator: {
    type: "circulator",
    sheetKinds: BOTH,
    label: "Circulator",
    category: "microwave",
    ports: [
      { side: "left", index: 0 },
      { side: "right", index: 0 },
      { side: "bottom", index: 0 },
    ],
    defaultSize: { width: 60, height: 60 },
    allowedLineTypes: null,
    defaultFields: {},
  },
  isolator: {
    type: "isolator",
    sheetKinds: BOTH,
    label: "Isolator",
    category: "microwave",
    ports: INLINE_2,
    defaultSize: { width: 60, height: 60 },
    allowedLineTypes: null,
    defaultFields: {},
  },
  directional_coupler: {
    type: "directional_coupler",
    sheetKinds: BOTH,
    label: "Directional Coupler",
    category: "microwave",
    ports: [
      { side: "left", index: 0 },
      { side: "right", index: 0 },
      { side: "top", index: 0 },
      { side: "bottom", index: 0 },
    ],
    defaultSize: { width: 80, height: 60 },
    allowedLineTypes: null,
    defaultFields: {},
  },
  power_splitter: {
    type: "power_splitter",
    sheetKinds: BOTH,
    label: "Power Splitter",
    category: "microwave",
    ports: [
      { side: "left", index: 0 },
      { side: "right", index: 0 },
      { side: "right", index: 1 },
    ],
    defaultSize: { width: 70, height: 70 },
    allowedLineTypes: null,
    defaultFields: {},
  },
  sma_connector: {
    type: "sma_connector",
    sheetKinds: BOTH,
    label: "SMA Connector",
    category: "connector",
    ports: SINGLE_LEFT,
    defaultSize: { width: 40, height: 40 },
    allowedLineTypes: null,
    defaultFields: {},
  },
  thermometer: {
    type: "thermometer",
    sheetKinds: FRIDGE,
    label: "Thermometer",
    category: "fridge",
    ports: SINGLE_LEFT,
    defaultSize: { width: 50, height: 50 },
    allowedLineTypes: ["thermometry"],
    defaultFields: {},
  },
  heater: {
    type: "heater",
    sheetKinds: FRIDGE,
    label: "Heater",
    category: "fridge",
    ports: SINGLE_LEFT,
    defaultSize: { width: 50, height: 50 },
    allowedLineTypes: ["heater"],
    defaultFields: {},
  },
  dut: {
    type: "dut",
    sheetKinds: FRIDGE,
    label: "Device / Sample",
    category: "fridge",
    ports: [{ side: "top", index: 0 }],
    defaultSize: { width: 100, height: 60 },
    allowedLineTypes: null,
    defaultFields: {},
  },
  input_port: {
    type: "input_port",
    sheetKinds: BOTH,
    label: "Input",
    category: "io",
    ports: SINGLE_LEFT,
    defaultSize: { width: 64, height: 40 },
    allowedLineTypes: null,
    defaultFields: {},
  },
  output_port: {
    type: "output_port",
    sheetKinds: BOTH,
    label: "Output",
    category: "io",
    ports: SINGLE_LEFT,
    defaultSize: { width: 64, height: 40 },
    allowedLineTypes: null,
    defaultFields: {},
  },
  bidir_port: {
    type: "bidir_port",
    sheetKinds: BOTH,
    label: "Bidirectional",
    category: "io",
    ports: SINGLE_LEFT,
    defaultSize: { width: 64, height: 40 },
    allowedLineTypes: null,
    defaultFields: {},
  },

  // Room-temperature bench instruments. Port labels are decoration
  // here; per-instance labels/roles land in a later phase.
  signal_generator: {
    type: "signal_generator",
    sheetKinds: ROOM_TEMP,
    label: "Signal Generator",
    category: "source",
    ports: [{ side: "right", index: 0 }],
    defaultSize: { width: 70, height: 70 },
    allowedLineTypes: null,
    defaultFields: {},
  },
  awg: {
    type: "awg",
    sheetKinds: ROOM_TEMP,
    label: "AWG",
    category: "source",
    ports: [{ side: "right", index: 0 }],
    defaultSize: { width: 80, height: 70 },
    allowedLineTypes: null,
    defaultFields: {},
  },
  vna: {
    type: "vna",
    sheetKinds: ROOM_TEMP,
    label: "VNA",
    category: "instrument",
    // Measurement port, facing the chain it drives.
    ports: SINGLE_LEFT,
    defaultSize: { width: 90, height: 70 },
    allowedLineTypes: null,
    defaultFields: {},
  },
  digitizer: {
    type: "digitizer",
    sheetKinds: ROOM_TEMP,
    label: "Digitizer",
    category: "instrument",
    // Acquisition input.
    ports: SINGLE_LEFT,
    defaultSize: { width: 90, height: 70 },
    allowedLineTypes: null,
    defaultFields: {},
  },
  dio_module: {
    type: "dio_module",
    sheetKinds: ROOM_TEMP,
    label: "DIO Module",
    category: "instrument",
    // Control output.
    ports: [{ side: "right", index: 0 }],
    defaultSize: { width: 90, height: 70 },
    allowedLineTypes: null,
    defaultFields: {},
  },
  mixer: {
    type: "mixer",
    sheetKinds: ROOM_TEMP,
    label: "Mixer",
    category: "microwave",
    // RF in (left), LO (bottom), IF out (right).
    ports: [
      { side: "left", index: 0 },
      { side: "bottom", index: 0 },
      { side: "right", index: 0 },
    ],
    defaultSize: { width: 70, height: 70 },
    allowedLineTypes: null,
    defaultFields: {},
  },
  rf_switch: {
    type: "rf_switch",
    sheetKinds: ROOM_TEMP,
    label: "RF Switch",
    category: "microwave",
    // COM (left), two throws (right), TRIG (bottom).
    ports: [
      { side: "left", index: 0 },
      { side: "right", index: 0 },
      { side: "right", index: 1 },
      { side: "bottom", index: 0 },
    ],
    defaultSize: { width: 80, height: 80 },
    allowedLineTypes: null,
    defaultFields: {},
  },
  power_combiner: {
    type: "power_combiner",
    sheetKinds: ROOM_TEMP,
    label: "Power Combiner",
    category: "microwave",
    // Two inputs (left), one output (right).
    ports: [
      { side: "left", index: 0 },
      { side: "left", index: 1 },
      { side: "right", index: 0 },
    ],
    defaultSize: { width: 70, height: 70 },
    allowedLineTypes: null,
    defaultFields: {},
  },
  bias_tee: {
    type: "bias_tee",
    sheetKinds: ROOM_TEMP,
    label: "Bias Tee",
    category: "microwave",
    // RF in (left), RF+DC out (right), DC in (bottom).
    ports: [
      { side: "left", index: 0 },
      { side: "right", index: 0 },
      { side: "bottom", index: 0 },
    ],
    defaultSize: { width: 80, height: 70 },
    allowedLineTypes: null,
    defaultFields: {},
  },
  termination: {
    type: "termination",
    sheetKinds: BOTH,
    label: "Termination",
    category: "passive",
    ports: SINGLE_LEFT,
    defaultSize: { width: 50, height: 50 },
    allowedLineTypes: null,
    defaultFields: { value: "50 Ω" },
  },
  fridge_port: {
    type: "fridge_port",
    sheetKinds: ROOM_TEMP,
    label: "Fridge Port",
    category: "io",
    // The bench side; the link to a fridge line is wired up in a later phase.
    ports: SINGLE_LEFT,
    defaultSize: { width: 72, height: 56 },
    allowedLineTypes: null,
    defaultFields: {},
  },
};

/** All built-in definitions in the canonical (enum) order. */
export const COMPONENT_DEFINITIONS: BuiltInComponentDefinition[] =
  BUILT_IN_COMPONENT_TYPES.map((type) => COMPONENT_LIBRARY[type]);

export function getComponentDefinition(
  type: BuiltInComponentType,
): BuiltInComponentDefinition {
  return COMPONENT_LIBRARY[type];
}

export function componentsByCategory(
  category: ComponentCategory,
  kind?: SheetKind,
): BuiltInComponentDefinition[] {
  return COMPONENT_DEFINITIONS.filter(
    (def) =>
      def.category === category &&
      (kind == null || def.sheetKinds.includes(kind)),
  );
}
