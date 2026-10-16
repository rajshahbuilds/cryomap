import { z } from "zod";

/**
 * Domain enum vocabularies. These narrow the `text` columns in the DB schema
 * into first-class unions, and double as the source for dropdowns and
 * runtime validation. Each is exported as a const array (for iteration/UI), a
 * Zod schema (for validation), and an inferred TS union type.
 */

export const LINE_TYPES = [
  "microwave_input",
  "microwave_output",
  "readout_input",
  "readout_output",
  "xy_drive",
  "flux_z",
  "dc_bias",
  "pump",
  "thermometry",
  "heater",
  "ground",
  "custom",
] as const;
export const lineTypeSchema = z.enum(LINE_TYPES);
export type LineType = z.infer<typeof lineTypeSchema>;

export const DIRECTIONS = ["input", "output", "bidirectional"] as const;
export const directionSchema = z.enum(DIRECTIONS);
export type Direction = z.infer<typeof directionSchema>;

/** Shared status vocabulary for lines and components. */
export const ENTITY_STATUSES = [
  "planned",
  "installed",
  "working",
  "noisy",
  "broken",
  "spare",
  "removed",
  "unknown",
] as const;
export const entityStatusSchema = z.enum(ENTITY_STATUSES);
export type EntityStatus = z.infer<typeof entityStatusSchema>;

export const SNAPSHOT_TYPES = ["current", "planned"] as const;
export const snapshotTypeSchema = z.enum(SNAPSHOT_TYPES);
export type SnapshotType = z.infer<typeof snapshotTypeSchema>;

/**
 * What kind of canvas a sheet is. A fridge has exactly one `"fridge"`
 * sheet — the cryogenic wiring, organized by temperature stage and flowing
 * top-down — and any number of `"room_temp"` sheets: bench instrumentation,
 * free-floating and flowing left→right. Stages and lines exist only on the
 * fridge sheet.
 */
export const SHEET_KINDS = ["fridge", "room_temp"] as const;
export const sheetKindSchema = z.enum(SHEET_KINDS);
export type SheetKind = z.infer<typeof sheetKindSchema>;

/** Built-in component types (custom components use the `"custom"` discriminator). */
export const BUILT_IN_COMPONENT_TYPES = [
  "attenuator",
  "filter_lp",
  "filter_hp",
  "filter_bp",
  "dc_block",
  "feedthrough",
  "amplifier_hemt",
  "amplifier_roomtemp",
  "amplifier_parametric",
  "circulator",
  "isolator",
  "directional_coupler",
  "power_splitter",
  "sma_connector",
  "thermometer",
  "heater",
  "dut",
  "input_port",
  "output_port",
  "bidir_port",
  // Room-temperature bench instruments.
  "signal_generator",
  "vna",
  "awg",
  "digitizer",
  "rf_switch",
  "mixer",
  "power_combiner",
  "termination",
  "bias_tee",
  "dio_module",
  "fridge_port",
] as const;
export const builtInComponentTypeSchema = z.enum(BUILT_IN_COMPONENT_TYPES);
export type BuiltInComponentType = z.infer<typeof builtInComponentTypeSchema>;

export const componentTypeSchema = z.union([
  builtInComponentTypeSchema,
  z.literal("custom"),
]);
export type ComponentType = z.infer<typeof componentTypeSchema>;

export const PORT_SIDES = ["left", "right", "top", "bottom"] as const;
export const portSideSchema = z.enum(PORT_SIDES);
export type PortSide = z.infer<typeof portSideSchema>;

/** A port on a (custom) component symbol. */
export const portSchema = z.object({
  side: portSideSchema,
  index: z.number().int().nonnegative(),
});
export type Port = z.infer<typeof portSchema>;

export const ROTATIONS = [0, 90, 180, 270] as const;
export const rotationSchema = z.union([
  z.literal(0),
  z.literal(90),
  z.literal(180),
  z.literal(270),
]);
export type Rotation = z.infer<typeof rotationSchema>;

/**
 * A member's role within a workspace. Ranked admin > editor > viewer:
 * admin manages members/invites/settings, editor edits diagrams (can take the
 * lock), viewer is read-only.
 */
export const WORKSPACE_ROLES = ["admin", "editor", "viewer"] as const;
export const workspaceRoleSchema = z.enum(WORKSPACE_ROLES);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
