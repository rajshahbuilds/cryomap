import {
  DEFAULT_WIRE_PROPERTIES,
  wireSegmentEndpoints,
  type WireProperties,
  type DiagramState,
  wireSegmentKey,
  type WireReference,
} from "@/lib/types";
import {
  connectionsRepo,
  linesRepo,
  wireSegmentPropertiesRepo,
  type Db,
} from "@/lib/repositories";
import type { UndoCommand } from "./undoStack";

export type { WireReference } from "@/lib/types";
async function findSegment(
  db: Db,
  target: Extract<WireReference, { kind: "implicit" }>,
) {
  return (
    await wireSegmentPropertiesRepo(db).listByFridge(target.fridge_id)
  ).find((row) => wireSegmentKey(row) === wireSegmentKey(target));
}
/** Properties edits preserve connectivity and are one reversible step. */
export function wirePropertiesCommand(
  target: WireReference,
  before: WireProperties,
  patch: Partial<WireProperties>,
): UndoCommand {
  const metadataId = crypto.randomUUID();
  let previous: WireProperties | undefined;
  let existed: boolean | undefined;
  const updateState = (
    state: DiagramState,
    values: Partial<WireProperties> | null,
  ): DiagramState => {
    if (target.kind === "line_entry")
      return {
        ...state,
        lines: state.lines.map((line) =>
          line.id === target.id
            ? {
                ...line,
                entry_wire_properties: {
                  ...(line.entry_wire_properties ?? DEFAULT_WIRE_PROPERTIES),
                  ...values,
                },
              }
            : line,
        ),
      };
    if (target.kind === "explicit")
      return {
        ...state,
        connections: state.connections.map((c) =>
          c.id === target.id
            ? { ...c, wire_properties: { ...c.wire_properties, ...values } }
            : c,
        ),
      };
    const rows = state.wireSegmentProperties;
    const existing = rows.find(
      (row) => wireSegmentKey(row) === wireSegmentKey(target),
    );
    if (!values)
      return {
        ...state,
        wireSegmentProperties: rows.filter(
          (row) => wireSegmentKey(row) !== wireSegmentKey(target),
        ),
      };
    const properties = {
      ...(existing?.wire_properties ?? DEFAULT_WIRE_PROPERTIES),
      ...values,
    };
    const row = {
      id: existing?.id ?? metadataId,
      fridge_id: target.fridge_id,
      sheet_id: target.sheet_id,
      line_id: target.line_id,
      ...wireSegmentEndpoints(target.from_component_id, target.to_component_id),
      wire_properties: properties,
      created_at: existing?.created_at ?? new Date().toISOString(),
    };
    return {
      ...state,
      wireSegmentProperties: existing
        ? rows.map((s) => (s.id === existing.id ? row : s))
        : [...rows, row],
    };
  };
  async function apply(db: Db, undo: boolean) {
    if (target.kind === "line_entry") {
      const repo = linesRepo(db);
      const current = await repo.get(target.id);
      previous ??= current.entry_wire_properties;
      await repo.update(target.id, {
        entry_wire_properties: undo
          ? previous
          : { ...current.entry_wire_properties, ...patch },
      });
      return;
    }
    if (target.kind === "explicit") {
      const repo = connectionsRepo(db);
      const current = await repo.get(target.id);
      previous ??= current.wire_properties;
      await repo.update(target.id, {
        wire_properties: undo
          ? previous
          : { ...current.wire_properties, ...patch },
      });
      return;
    }
    const repo = wireSegmentPropertiesRepo(db);
    const existing = await findSegment(db, target);
    existed ??= Boolean(existing);
    previous ??= existing?.wire_properties ?? before ?? DEFAULT_WIRE_PROPERTIES;
    if (undo && !existed) {
      if (existing) await repo.remove(existing.id);
      return;
    }
    const values = undo
      ? previous
      : { ...(existing?.wire_properties ?? DEFAULT_WIRE_PROPERTIES), ...patch };
    if (existing) await repo.update(existing.id, { wire_properties: values });
    else
      await repo.create(
        {
          fridge_id: target.fridge_id,
          sheet_id: target.sheet_id,
          line_id: target.line_id,
          from_component_id: target.from_component_id,
          to_component_id: target.to_component_id,
          wire_properties: values,
        },
        metadataId,
      );
  }
  return {
    reconcileAfter: true,
    optimisticRedo: (state) => updateState(state, patch),
    optimisticUndo: (state) =>
      updateState(
        state,
        target.kind === "implicit" && existed === false
          ? null
          : (previous ?? before),
      ),
    redo: (db) => apply(db, false),
    undo: (db) => apply(db, true),
  };
}
