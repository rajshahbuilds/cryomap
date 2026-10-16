import { z } from "zod";
import {
  directionSchema,
  entityStatusSchema,
  componentTypeSchema,
  lineTypeSchema,
  portSchema,
  portSideSchema,
  rotationSchema,
  sheetKindSchema,
  workspaceRoleSchema,
} from "./enums";

/**
 * Canonical row schemas + create/update payload schemas for every table.
 *
 * These Zod schemas are the single source of truth for the domain shapes:
 * row types are inferred from them (`z.infer`), and they validate data at the
 * app boundary (forms, snapshot contents). They mirror the DB schema
 * exactly — keys and nullability match the generated `database.ts` — while
 * narrowing `text` enum columns into the unions from `./enums`.
 *
 * `versions` lives in `./snapshot` (it embeds the snapshot shape).
 */

const uuid = z.uuid();
const timestamp = z.string(); // ISO timestamptz as returned by PostgREST
const extraFieldsSchema = z.record(z.string(), z.string());

// profiles -----------------------------------------------------------------
export const profileRowSchema = z.object({
  id: uuid,
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  email: z.string().nullable(),
  created_at: timestamp,
});
export type Profile = z.infer<typeof profileRowSchema>;

// workspaces ---------------------------------------------------------------
// A lab. Owns fridges; has members and invite links.
export const workspaceRowSchema = z.object({
  id: uuid,
  name: z.string(),
  created_by: uuid.nullable(),
  created_at: timestamp,
  updated_at: timestamp,
});
export type Workspace = z.infer<typeof workspaceRowSchema>;

export const workspaceCreateSchema = z.object({
  name: z.string().min(1),
});
export type WorkspaceCreateInput = z.infer<typeof workspaceCreateSchema>;
export const workspaceUpdateSchema = workspaceCreateSchema.partial();
export type WorkspaceUpdateInput = z.infer<typeof workspaceUpdateSchema>;

// workspace_members --------------------------------------------------------
export const workspaceMemberRowSchema = z.object({
  workspace_id: uuid,
  user_id: uuid,
  role: workspaceRoleSchema,
  created_at: timestamp,
});
export type WorkspaceMember = z.infer<typeof workspaceMemberRowSchema>;

// workspace_invites --------------------------------------------------------
// Shareable invite links; the granted role is baked in. Multi-use until they
// expire or are revoked.
export const workspaceInviteRowSchema = z.object({
  id: uuid,
  workspace_id: uuid,
  token: z.string(),
  role: workspaceRoleSchema,
  expires_at: timestamp.nullable(),
  revoked_at: timestamp.nullable(),
  created_by: uuid.nullable(),
  created_at: timestamp,
});
export type WorkspaceInvite = z.infer<typeof workspaceInviteRowSchema>;

// fridges ------------------------------------------------------------------
export const fridgeRowSchema = z.object({
  id: uuid,
  name: z.string(),
  vendor: z.string().nullable(),
  model: z.string().nullable(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  archived: z.boolean(),
  // Nullable while the collaboration feature was built; the column is now NOT NULL.
  workspace_id: uuid.nullable(),
  created_by: uuid.nullable(),
  created_at: timestamp,
  updated_at: timestamp,
});
export type Fridge = z.infer<typeof fridgeRowSchema>;

export const fridgeCreateSchema = z.object({
  name: z.string().min(1),
  vendor: z.string().nullish(),
  model: z.string().nullish(),
  description: z.string().nullish(),
  location: z.string().nullish(),
  archived: z.boolean().optional(),
  // Set by workspace-scoped creation; optional in the schema.
  workspace_id: uuid.nullish(),
});
export type FridgeCreateInput = z.infer<typeof fridgeCreateSchema>;
export const fridgeUpdateSchema = fridgeCreateSchema.partial();
export type FridgeUpdateInput = z.infer<typeof fridgeUpdateSchema>;

// sheets -------------------------------------------------------------------
// A named canvas belonging to a fridge. A fridge sheet owns its own
// stages and lines; a fridge may hold several. Room-temp sheets have neither,
// and hold free-floating bench instrumentation.
export const sheetRowSchema = z.object({
  id: uuid,
  fridge_id: uuid,
  kind: sheetKindSchema,
  name: z.string(),
  sort_order: z.number().int(),
  notes: z.string().nullable(),
  created_at: timestamp,
});
export type Sheet = z.infer<typeof sheetRowSchema>;

export const sheetCreateSchema = z.object({
  fridge_id: uuid,
  kind: sheetKindSchema.optional(),
  name: z.string().min(1),
  sort_order: z.number().int(),
  notes: z.string().nullish(),
});
export type SheetCreateInput = z.infer<typeof sheetCreateSchema>;
export const sheetUpdateSchema = sheetCreateSchema.partial();
export type SheetUpdateInput = z.infer<typeof sheetUpdateSchema>;

// stages -------------------------------------------------------------------
export const stageRowSchema = z.object({
  id: uuid,
  fridge_id: uuid.nullable(),
  // Null until the backfill lands, and absent from pre-sheets snapshots
  // (see `supabase/migrations/20260709230100_stages_lines_sheet_id_not_null.sql`).
  sheet_id: uuid.nullable().default(null),
  name: z.string(),
  nominal_temp: z.string().nullable(),
  color: z.string().nullable(),
  sort_order: z.number().int(),
  height_px: z.number().int(),
  hidden: z.boolean(),
  locked: z.boolean(),
});
export type Stage = z.infer<typeof stageRowSchema>;

export const stageCreateSchema = z.object({
  fridge_id: uuid,
  sheet_id: uuid.nullish(),
  name: z.string().min(1),
  nominal_temp: z.string().nullish(),
  color: z.string().nullish(),
  sort_order: z.number().int(),
  height_px: z.number().int().positive().optional(),
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
});
export type StageCreateInput = z.infer<typeof stageCreateSchema>;
export const stageUpdateSchema = stageCreateSchema.partial();
export type StageUpdateInput = z.infer<typeof stageUpdateSchema>;

// lines --------------------------------------------------------------------
export const lineRowSchema = z.object({
  id: uuid,
  fridge_id: uuid.nullable(),
  sheet_id: uuid.nullable().default(null),
  name: z.string(),
  line_type: lineTypeSchema.nullable(),
  direction: directionSchema.nullable(),
  status: entityStatusSchema,
  notes: z.string().nullable(),
  sort_order: z.number().int(),
  // Column width in logical units. Defaulted so older snapshots (whose
  // line rows predate the column) still validate.
  width_px: z.number().int().default(120),
  show_label: z.boolean(),
  created_at: timestamp,
});
export type Line = z.infer<typeof lineRowSchema>;

export const lineCreateSchema = z.object({
  fridge_id: uuid,
  sheet_id: uuid.nullish(),
  name: z.string().min(1),
  line_type: lineTypeSchema.nullish(),
  direction: directionSchema.nullish(),
  status: entityStatusSchema.optional(),
  notes: z.string().nullish(),
  sort_order: z.number().int(),
  width_px: z.number().int().positive().optional(),
  show_label: z.boolean().optional(),
});
export type LineCreateInput = z.infer<typeof lineCreateSchema>;
export const lineUpdateSchema = lineCreateSchema.partial();
export type LineUpdateInput = z.infer<typeof lineUpdateSchema>;

// custom_component_defs ----------------------------------------------------
export const customComponentDefRowSchema = z.object({
  id: uuid,
  fridge_id: uuid.nullable(),
  name: z.string(),
  width_px: z.number().int(),
  height_px: z.number().int(),
  ports: z.array(portSchema),
  extra_field_keys: z.array(z.string()).nullable(),
  created_by: uuid.nullable(),
  created_at: timestamp,
});
export type CustomComponentDef = z.infer<typeof customComponentDefRowSchema>;

export const customComponentDefCreateSchema = z.object({
  fridge_id: uuid,
  name: z.string().min(1),
  width_px: z.number().int().positive().optional(),
  height_px: z.number().int().positive().optional(),
  ports: z.array(portSchema).optional(),
  extra_field_keys: z.array(z.string()).nullish(),
});
export type CustomComponentDefCreateInput = z.infer<
  typeof customComponentDefCreateSchema
>;
export const customComponentDefUpdateSchema =
  customComponentDefCreateSchema.partial();
export type CustomComponentDefUpdateInput = z.infer<
  typeof customComponentDefUpdateSchema
>;

// components ---------------------------------------------------------------
export const componentRowSchema = z.object({
  id: uuid,
  fridge_id: uuid.nullable(),
  // The sheet this component is drawn on. Defaulted so snapshots taken before
  // sheets existed still validate; nullable until the NOT NULL migration lands
  // (see `supabase/migrations/20260709220200_sheets_sheet_id_not_null.sql`).
  sheet_id: uuid.nullable().default(null),
  line_id: uuid.nullable(),
  stage_id: uuid.nullable(),
  // A `fridge_port` on a room-temp sheet may link to a fridge line, so
  // clicking that line traces the bench chain driving it. Defaulted so
  // older snapshots still validate.
  linked_line_id: uuid.nullable().default(null),
  component_type: componentTypeSchema,
  custom_def_id: uuid.nullable(),
  label: z.string().nullable(),
  value: z.string().nullable(),
  manufacturer: z.string().nullable(),
  part_number: z.string().nullable(),
  serial_number: z.string().nullable(),
  frequency_range: z.string().nullable(),
  power_rating: z.string().nullable(),
  datasheet_url: z.string().nullable(),
  notes: z.string().nullable(),
  extra_fields: extraFieldsSchema,
  x_offset: z.number().int(),
  rotation: rotationSchema,
  // Defaulted so snapshots taken before the mirror column still validate.
  mirrored: z.boolean().default(false),
  free_floating: z.boolean(),
  x_abs: z.number().int().nullable(),
  y_abs: z.number().int().nullable(),
  last_edited_by: uuid.nullable(),
  last_edited_at: timestamp,
  created_at: timestamp,
});
export type Component = z.infer<typeof componentRowSchema>;

export const componentCreateSchema = z.object({
  fridge_id: uuid,
  sheet_id: uuid.nullish(),
  line_id: uuid.nullish(),
  stage_id: uuid.nullish(),
  linked_line_id: uuid.nullish(),
  component_type: componentTypeSchema,
  custom_def_id: uuid.nullish(),
  label: z.string().nullish(),
  value: z.string().nullish(),
  manufacturer: z.string().nullish(),
  part_number: z.string().nullish(),
  serial_number: z.string().nullish(),
  frequency_range: z.string().nullish(),
  power_rating: z.string().nullish(),
  datasheet_url: z.url().nullish(),
  notes: z.string().nullish(),
  extra_fields: extraFieldsSchema.optional(),
  x_offset: z.number().int().optional(),
  rotation: rotationSchema.optional(),
  mirrored: z.boolean().optional(),
  free_floating: z.boolean().optional(),
  x_abs: z.number().int().nullish(),
  y_abs: z.number().int().nullish(),
});
export type ComponentCreateInput = z.infer<typeof componentCreateSchema>;
export const componentUpdateSchema = componentCreateSchema.partial();
export type ComponentUpdateInput = z.infer<typeof componentUpdateSchema>;

// locks --------------------------------------------------------------------
export const lockRowSchema = z.object({
  fridge_id: uuid,
  locked_by: uuid.nullable(),
  locked_at: timestamp,
  expires_at: timestamp.nullable(),
});
export type Lock = z.infer<typeof lockRowSchema>;

export const lockCreateSchema = z.object({
  fridge_id: uuid,
  locked_by: uuid,
  expires_at: timestamp.nullish(),
});
export type LockCreateInput = z.infer<typeof lockCreateSchema>;

// connections --------------------------------------------------------------
export const connectionRowSchema = z.object({
  id: uuid,
  fridge_id: uuid.nullable(),
  // Denormalized from the endpoints (both are always on the same sheet).
  // Defaulted for pre-sheets snapshots, as on `componentRowSchema`.
  sheet_id: uuid.nullable().default(null),
  from_component_id: uuid,
  from_port_side: portSideSchema,
  from_port_index: z.number().int(),
  to_component_id: uuid,
  to_port_side: portSideSchema,
  to_port_index: z.number().int(),
  created_at: timestamp,
});
export type Connection = z.infer<typeof connectionRowSchema>;

export const connectionCreateSchema = z.object({
  fridge_id: uuid,
  sheet_id: uuid.nullish(),
  from_component_id: uuid,
  from_port_side: portSideSchema,
  from_port_index: z.number().int().nonnegative().optional(),
  to_component_id: uuid,
  to_port_side: portSideSchema,
  to_port_index: z.number().int().nonnegative().optional(),
});
export type ConnectionCreateInput = z.infer<typeof connectionCreateSchema>;

// annotations --------------------------------------------------------------
// Free-floating text on a sheet: a positioned note, not attached to any
// component.
export const annotationRowSchema = z.object({
  id: uuid,
  fridge_id: uuid,
  sheet_id: uuid,
  text: z.string(),
  x_abs: z.number().int(),
  y_abs: z.number().int(),
  created_by: uuid.nullable(),
  created_at: timestamp,
});
export type Annotation = z.infer<typeof annotationRowSchema>;

export const annotationCreateSchema = z.object({
  fridge_id: uuid,
  sheet_id: uuid,
  text: z.string().optional(),
  x_abs: z.number().int(),
  y_abs: z.number().int(),
});
export type AnnotationCreateInput = z.infer<typeof annotationCreateSchema>;
export const annotationUpdateSchema = annotationCreateSchema.partial();
export type AnnotationUpdateInput = z.infer<typeof annotationUpdateSchema>;
