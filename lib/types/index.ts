/**
 * Canonical types + runtime validation for CryoMap, mirroring the DB schema.
 *
 * - `enums` — domain enum vocabularies (line type, direction, status, …).
 * - `rows` — per-table row schemas + create/update payload schemas.
 * - `snapshot` — the `versions.snapshot` shape, serializer, and version schemas.
 * - `database` — generated Supabase types, re-exported for typing the client.
 *
 * Everything else in the app imports domain types from here.
 */
export * from "./enums";
export * from "./rows";
export * from "./snapshot";

export type {
  Database,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "./database";
