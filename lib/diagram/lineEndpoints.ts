import type { Component, Line } from "@/lib/types";
import { componentsRepo } from "@/lib/repositories";
import type { UndoCommand } from "./undoStack";
import { LINE_ENDPOINT_Y } from "./lineConnections";

export function lineEndpointType(line: Line) {
  return line.direction === "output"
    ? ("output_port" as const)
    : line.direction === "bidirectional"
      ? ("bidir_port" as const)
      : ("input_port" as const);
}

/** Legacy lines get a stable virtual component until their first interaction.
 * Actual wires always reference persisted components, using the existing FK,
 * routing, port picking, undo, and snapshot machinery.
 */
export function lineEndpointComponent(line: Line, x: number): Component {
  return {
    id: line.id,
    fridge_id: line.fridge_id,
    sheet_id: line.sheet_id,
    line_id: null,
    stage_id: null,
    linked_line_id: null,
    line_endpoint_id: line.id,
    line_entry_port: null,
    line_exit_port: null,
    component_type: lineEndpointType(line),
    custom_def_id: null,
    label: line.name,
    value: null,
    manufacturer: null,
    part_number: null,
    serial_number: null,
    frequency_range: null,
    power_rating: null,
    datasheet_url: null,
    notes: null,
    extra_fields: {},
    x_offset: 0,
    // Built-in I/O ports have their one terminal on the local left.
    // The fridge base turn is 90°, so another 180° points it down.
    rotation: 180,
    mirrored: false,
    free_floating: true,
    x_abs: x,
    y_abs: LINE_ENDPOINT_Y - 32,
    last_edited_by: null,
    last_edited_at: line.created_at,
    created_at: line.created_at,
  };
}

/** Materialize only the endpoints touched by an edit, as part of its undo step.
 * Re-check at execution time: queued edits may have captured the same virtual port.
 */
export function materializeLineEndpointsCommand(
  command: UndoCommand,
  endpoints: Component[],
): UndoCommand {
  if (!endpoints.length) return command;
  let created: Component[] = [];
  return {
    reconcileAfter: true,
    redo: async (db) => {
      created = [];
      const existing = await componentsRepo(db).listByFridge(
        endpoints[0].fridge_id!,
      );
      for (const endpoint of endpoints) {
        if (existing.some((c) => c.id === endpoint.id)) continue;
        const { id, created_at, last_edited_at, last_edited_by, ...input } =
          endpoint;
        void created_at;
        void last_edited_at;
        void last_edited_by;
        await componentsRepo(db).create(
          { ...input, fridge_id: endpoint.fridge_id! },
          id,
        );
        created.push(endpoint);
      }
      try {
        await command.redo(db);
      } catch (error) {
        for (const endpoint of created)
          await componentsRepo(db).remove(endpoint.id);
        throw error;
      }
    },
    undo: async (db) => {
      await command.undo(db);
      for (const endpoint of created)
        await componentsRepo(db).remove(endpoint.id);
    },
  };
}
