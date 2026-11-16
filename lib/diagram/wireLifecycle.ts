import type { Connection, WireSegmentProperties } from "@/lib/types";
import {
  componentsRepo,
  connectionsRepo,
  linesRepo,
  sheetsRepo,
  wireSegmentPropertiesRepo,
  type Db,
} from "@/lib/repositories";
import type { UndoCommand } from "./undoStack";
import { wireSegmentKey } from "@/lib/types";

/** Capture cascaded wire rows so undoing a structural edit restores them too.
 * Parent/entity undo preserves ids; copies and version restores still remap ids.
 * Explicit cleanup also models the real database cascades in the test fake.
 */
export function preserveWiresCommand(
  command: UndoCommand,
  fridgeId: string,
): UndoCommand {
  let connections: Connection[] = [];
  let segments: WireSegmentProperties[] = [];
  async function context(db: Db) {
    const [components, lines, sheets] = await Promise.all([
      componentsRepo(db).listByFridge(fridgeId),
      linesRepo(db).listByFridge(fridgeId),
      sheetsRepo(db).listByFridge(fridgeId),
    ]);
    const byId = new Map(components.map((c) => [c.id, c]));
    const lineById = new Map(lines.map((l) => [l.id, l]));
    const sheetById = new Map(sheets.map((s) => [s.id, s]));
    return {
      connectionValid: (c: Connection) =>
        byId.has(c.from_component_id) && byId.has(c.to_component_id),
      segmentValid: (s: WireSegmentProperties) => {
        const a = byId.get(s.from_component_id),
          b = byId.get(s.to_component_id),
          l = lineById.get(s.line_id);
        return (
          a &&
          b &&
          l &&
          !a.free_floating &&
          !b.free_floating &&
          a.line_id === l.id &&
          b.line_id === l.id &&
          a.sheet_id === s.sheet_id &&
          b.sheet_id === s.sheet_id &&
          l.sheet_id === s.sheet_id &&
          sheetById.get(s.sheet_id)?.kind === "fridge"
        );
      },
    };
  }
  return {
    optimisticRedo: command.optimisticRedo,
    optimisticUndo: command.optimisticUndo,
    reconcileAfter: true,
    // Structural edits reconcile after completion, including database cascades.
    redo: async (db) => {
      [connections, segments] = await Promise.all([
        connectionsRepo(db).listByFridge(fridgeId),
        wireSegmentPropertiesRepo(db).listByFridge(fridgeId),
      ]);
      await command.redo(db);
      const valid = await context(db);
      const [liveConnections, liveSegments] = await Promise.all([
        connectionsRepo(db).listByFridge(fridgeId),
        wireSegmentPropertiesRepo(db).listByFridge(fridgeId),
      ]);
      for (const row of liveConnections)
        if (!valid.connectionValid(row))
          await connectionsRepo(db).remove(row.id);
      for (const row of liveSegments)
        if (!valid.segmentValid(row))
          await wireSegmentPropertiesRepo(db).remove(row.id);
    },
    undo: async (db) => {
      await command.undo(db);
      const valid = await context(db);
      const [liveConnections, liveSegments] = await Promise.all([
        connectionsRepo(db).listByFridge(fridgeId),
        wireSegmentPropertiesRepo(db).listByFridge(fridgeId),
      ]);
      const connectionIds = new Set(liveConnections.map((c) => c.id));
      const segmentKeys = new Set(liveSegments.map(wireSegmentKey));
      for (const c of connections)
        if (!connectionIds.has(c.id) && valid.connectionValid(c))
          await connectionsRepo(db).create({ ...c, fridge_id: fridgeId }, c.id);
      for (const s of segments)
        if (!segmentKeys.has(wireSegmentKey(s)) && valid.segmentValid(s))
          await wireSegmentPropertiesRepo(db).create(s);
    },
  };
}
