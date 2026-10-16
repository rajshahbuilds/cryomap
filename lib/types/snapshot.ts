import { z } from "zod";
import { snapshotTypeSchema } from "./enums";
import {
  annotationRowSchema,
  componentRowSchema,
  connectionRowSchema,
  customComponentDefRowSchema,
  lineRowSchema,
  sheetRowSchema,
  stageRowSchema,
  type Annotation,
  type Component,
  type Connection,
  type CustomComponentDef,
  type Line,
  type Sheet,
  type Stage,
} from "./rows";

/**
 * A `versions.snapshot` JSON payload: a full point-in-time copy of a fridge's
 * diagram — every sheet of it. Composed from the canonical row schemas so it
 * validates losslessly.
 */
export const snapshotSchema = z.object({
  stages: z.array(stageRowSchema),
  lines: z.array(lineRowSchema),
  components: z.array(componentRowSchema),
  custom_defs: z.array(customComponentDefRowSchema),
  // Defaulted so snapshots taken before connections existed still validate.
  connections: z.array(connectionRowSchema).default([]),
  // Likewise for snapshots taken before sheets. An empty array means a
  // pre-sheets snapshot; `restoreVersion` synthesizes the fridge sheet for it.
  sheets: z.array(sheetRowSchema).default([]),
  // Defaulted so snapshots taken before annotations still validate.
  annotations: z.array(annotationRowSchema).default([]),
  snapshotted_at: z.string(),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

/** The live diagram state held in memory by the editor: a whole fridge. */
export interface DiagramState {
  sheets: Sheet[];
  stages: Stage[];
  lines: Line[];
  components: Component[];
  customDefs: CustomComponentDef[];
  connections: Connection[];
  annotations: Annotation[];
}

/** Serialize live diagram state into a snapshot payload. */
export function serializeSnapshot(
  state: DiagramState,
  snapshottedAt: string = new Date().toISOString(),
): Snapshot {
  return {
    stages: state.stages,
    lines: state.lines,
    components: state.components,
    custom_defs: state.customDefs,
    connections: state.connections,
    sheets: state.sheets,
    annotations: state.annotations,
    snapshotted_at: snapshottedAt,
  };
}

/** Parse + validate an unknown snapshot payload (e.g. from `versions.snapshot`). */
export function parseSnapshot(input: unknown): Snapshot {
  return snapshotSchema.parse(input);
}

/**
 * Inverse of `serializeSnapshot`: a snapshot back into editor state.
 *
 * The arrays added after the first release (`connections`, `sheets`, then
 * `annotations`) are coalesced rather than read straight through. `snapshotSchema`
 * defaults them, but `versionsRepo` *casts* its rows instead of parsing them, so a
 * snapshot stored before those fields existed arrives here with the keys genuinely
 * absent — and `undefined.length` is a crash, not a blank diagram. Every version
 * row written before sheets existed is in exactly that shape.
 */
export function snapshotToState(snapshot: Snapshot): DiagramState {
  return {
    sheets: snapshot.sheets ?? [],
    stages: snapshot.stages,
    lines: snapshot.lines,
    components: snapshot.components,
    customDefs: snapshot.custom_defs,
    connections: snapshot.connections ?? [],
    annotations: snapshot.annotations ?? [],
  };
}

// versions -----------------------------------------------------------------
export const versionRowSchema = z.object({
  id: z.uuid(),
  fridge_id: z.uuid().nullable(),
  snapshot: snapshotSchema,
  commit_message: z.string(),
  tag: z.string().nullable(),
  snapshot_type: snapshotTypeSchema,
  author_id: z.uuid().nullable(),
  author_name: z.string().nullable(),
  created_at: z.string(),
});
export type Version = z.infer<typeof versionRowSchema>;

export const versionCreateSchema = z.object({
  fridge_id: z.uuid(),
  snapshot: snapshotSchema,
  commit_message: z.string().min(1),
  tag: z.string().nullish(),
  snapshot_type: snapshotTypeSchema.optional(),
  author_id: z.uuid().nullish(),
  author_name: z.string().nullish(),
});
export type VersionCreateInput = z.infer<typeof versionCreateSchema>;
