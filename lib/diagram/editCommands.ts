import type {
  Annotation,
  AnnotationCreateInput,
  AnnotationUpdateInput,
  Component,
  ComponentUpdateInput,
  Connection,
  ConnectionCreateInput,
  CustomComponentDef,
  CustomComponentDefCreateInput,
  CustomComponentDefUpdateInput,
  FridgeUpdateInput,
  Line,
  LineUpdateInput,
  Sheet,
  SheetKind,
  SheetUpdateInput,
  Stage,
  StageUpdateInput,
} from "@/lib/types";
import {
  annotationsRepo,
  componentsRepo,
  connectionsRepo,
  customComponentDefsRepo,
  fridgesRepo,
  linesRepo,
  sheetsRepo,
  stagesRepo,
  type Db,
} from "@/lib/repositories";
import type { UndoCommand } from "./undoStack";
import { recreateComponent } from "./componentService";
import { addLine, type NewLineValues } from "./lineService";
import { DEFAULT_STAGE_HEIGHT } from "./stageService";
import { planStageInsertion } from "./stageOrder";
import {
  NEW_SHEET_KIND,
  SHEET_KIND_NAME,
  nextSheetName,
  nextSheetSortOrder,
  type SheetOrderUpdate,
} from "./sheetService";
import type { ComponentShift, LineOrderUpdate } from "./lineOps";
import type { StageOrderUpdate } from "./stageOps";
import { withoutConnection } from "./optimisticState";

type Patch = Record<string, unknown>;

/** Run several commands as one atomic undo step: redo in order, undo reversed. */
export function sequenceCommand(...commands: UndoCommand[]): UndoCommand {
  return {
    redo: async (db) => {
      for (const command of commands) await command.redo(db);
    },
    undo: async (db) => {
      for (const command of [...commands].reverse()) await command.undo(db);
    },
  };
}

/** Shift each component's `x_abs` so it follows a moved line. */
export function componentXShiftCommand(shifts: ComponentShift[]): UndoCommand {
  const apply = (db: Db, key: "before" | "after") =>
    Promise.all(
      shifts.map((s) => componentsRepo(db).update(s.id, { x_abs: s[key] })),
    );
  return {
    redo: async (db) => {
      await apply(db, "after");
    },
    undo: async (db) => {
      await apply(db, "before");
    },
  };
}

/** A field update with a captured `before` so it can be reversed. */
function patchCommand(
  update: (db: Db, patch: Patch) => Promise<unknown>,
  before: Patch,
  after: Patch,
): UndoCommand {
  return {
    redo: async (db) => {
      await update(db, after);
    },
    undo: async (db) => {
      await update(db, before);
    },
  };
}

export function componentPatchCommand(
  id: string,
  before: Patch,
  after: Patch,
): UndoCommand {
  return patchCommand(
    (db, patch) => componentsRepo(db).update(id, patch as ComponentUpdateInput),
    before,
    after,
  );
}

export function linePatchCommand(
  id: string,
  before: Patch,
  after: Patch,
): UndoCommand {
  return patchCommand(
    (db, patch) => linesRepo(db).update(id, patch as LineUpdateInput),
    before,
    after,
  );
}

export function stagePatchCommand(
  id: string,
  before: Patch,
  after: Patch,
): UndoCommand {
  return patchCommand(
    (db, patch) => stagesRepo(db).update(id, patch as StageUpdateInput),
    before,
    after,
  );
}

export function fridgePatchCommand(
  id: string,
  before: Patch,
  after: Patch,
): UndoCommand {
  return patchCommand(
    (db, patch) => fridgesRepo(db).update(id, patch as FridgeUpdateInput),
    before,
    after,
  );
}

/** Reorder: `before`/`after` are the swapped sort_order pairs. */
export function lineOrderCommand(
  before: LineOrderUpdate[],
  after: LineOrderUpdate[],
): UndoCommand {
  const apply = (db: Db, updates: LineOrderUpdate[]) =>
    Promise.all(
      updates.map((u) =>
        linesRepo(db).update(u.id, { sort_order: u.sort_order }),
      ),
    );
  return {
    redo: async (db) => {
      await apply(db, after);
    },
    undo: async (db) => {
      await apply(db, before);
    },
  };
}

export function stageOrderCommand(
  before: StageOrderUpdate[],
  after: StageOrderUpdate[],
): UndoCommand {
  const apply = (db: Db, updates: StageOrderUpdate[]) =>
    Promise.all(
      updates.map((u) =>
        stagesRepo(db).update(u.id, { sort_order: u.sort_order }),
      ),
    );
  return {
    redo: async (db) => {
      await apply(db, after);
    },
    undo: async (db) => {
      await apply(db, before);
    },
  };
}

export function addLineCommand(
  fridgeId: string,
  sheetId: string,
  existing: Line[],
  values?: NewLineValues,
): UndoCommand {
  let id: string | null = null;
  return {
    redo: async (db) => {
      id = (await addLine(db, fridgeId, sheetId, existing, values)).id;
    },
    undo: async (db) => {
      if (id) await linesRepo(db).remove(id);
    },
  };
}

export interface NewStageValues {
  name: string;
  nominalTemp: string | null;
  color: string | null;
}

/**
 * Create a stage from the dialog's values, inserted at the position implied by
 * its temperature (hotter stages on top) rather than appended at the bottom.
 * Existing stages shift to make room; undo deletes the stage and restores their
 * original `sort_order`s.
 */
export function addStageCommand(
  fridgeId: string,
  sheetId: string,
  existing: Stage[],
  values: NewStageValues,
): UndoCommand {
  const plan = planStageInsertion(existing, values.nominalTemp);
  const before: StageOrderUpdate[] = plan.shifted.map((u) => ({
    id: u.id,
    sort_order: existing.find((s) => s.id === u.id)!.sort_order,
  }));
  const setOrders = (db: Db, updates: StageOrderUpdate[]) =>
    Promise.all(
      updates.map((u) =>
        stagesRepo(db).update(u.id, { sort_order: u.sort_order }),
      ),
    );
  let id: string | null = null;
  return {
    redo: async (db) => {
      await setOrders(db, plan.shifted);
      id = (
        await stagesRepo(db).create({
          fridge_id: fridgeId,
          sheet_id: sheetId,
          name: values.name,
          nominal_temp: values.nominalTemp,
          color: values.color,
          sort_order: plan.newSortOrder,
          height_px: DEFAULT_STAGE_HEIGHT,
        })
      ).id;
    },
    undo: async (db) => {
      if (id) await stagesRepo(db).remove(id);
      await setOrders(db, before);
    },
  };
}

export function addCustomDefCommand(
  input: CustomComponentDefCreateInput,
  createdBy?: string,
): UndoCommand {
  let id: string | null = null;
  return {
    redo: async (db) => {
      id = (await customComponentDefsRepo(db).create(input, createdBy)).id;
    },
    undo: async (db) => {
      if (id) await customComponentDefsRepo(db).remove(id);
    },
  };
}

/**
 * Delete a custom component definition. The editor only allows this for defs
 * with no placed instances (it blocks deletion while in use), so there are no
 * component FKs to remap; undo re-creates the def with a fresh id.
 */
export function deleteCustomDefCommand(def: CustomComponentDef): UndoCommand {
  let currentId = def.id;
  return {
    redo: async (db) => {
      await customComponentDefsRepo(db).remove(currentId);
    },
    undo: async (db) => {
      const recreated = await customComponentDefsRepo(db).create(
        {
          fridge_id: def.fridge_id ?? "",
          name: def.name,
          width_px: def.width_px,
          height_px: def.height_px,
          ports: def.ports,
          extra_field_keys: def.extra_field_keys,
        },
        def.created_by ?? undefined,
      );
      currentId = recreated.id;
    },
  };
}

export function customDefPatchCommand(
  id: string,
  before: CustomComponentDefUpdateInput,
  after: CustomComponentDefUpdateInput,
): UndoCommand {
  return {
    redo: async (db) => {
      await customComponentDefsRepo(db).update(id, after);
    },
    undo: async (db) => {
      await customComponentDefsRepo(db).update(id, before);
    },
  };
}

/** Delete a line + its components; undo re-creates both, remapping FKs. */
export function deleteLineCommand(
  line: Line,
  components: Component[],
): UndoCommand {
  let currentId = line.id;
  return {
    redo: async (db) => {
      await componentsRepo(db).removeByLine(currentId);
      await linesRepo(db).remove(currentId);
    },
    undo: async (db) => {
      const recreated = await linesRepo(db).create({
        fridge_id: line.fridge_id ?? "",
        sheet_id: line.sheet_id,
        name: line.name,
        line_type: line.line_type,
        direction: line.direction,
        status: line.status,
        notes: line.notes,
        sort_order: line.sort_order,
        width_px: line.width_px,
        show_label: line.show_label,
      });
      currentId = recreated.id;
      for (const component of components) {
        await recreateComponent(db, component, { line_id: recreated.id });
      }
    },
  };
}

/** Delete a stage + its components; undo re-creates both, remapping FKs. */
export function deleteStageCommand(
  stage: Stage,
  components: Component[],
): UndoCommand {
  let currentId = stage.id;
  return {
    redo: async (db) => {
      await componentsRepo(db).removeByStage(currentId);
      await stagesRepo(db).remove(currentId);
    },
    undo: async (db) => {
      const recreated = await stagesRepo(db).create({
        fridge_id: stage.fridge_id ?? "",
        sheet_id: stage.sheet_id,
        name: stage.name,
        nominal_temp: stage.nominal_temp,
        color: stage.color,
        sort_order: stage.sort_order,
        height_px: stage.height_px,
        hidden: stage.hidden,
        locked: stage.locked,
      });
      currentId = recreated.id;
      for (const component of components) {
        await recreateComponent(db, component, { stage_id: recreated.id });
      }
    },
  };
}

export function sheetPatchCommand(
  id: string,
  before: Patch,
  after: Patch,
): UndoCommand {
  return patchCommand(
    (db, patch) => sheetsRepo(db).update(id, patch as SheetUpdateInput),
    before,
    after,
  );
}

export function sheetOrderCommand(
  before: SheetOrderUpdate[],
  after: SheetOrderUpdate[],
): UndoCommand {
  const apply = (db: Db, updates: SheetOrderUpdate[]) =>
    Promise.all(
      updates.map((u) =>
        sheetsRepo(db).update(u.id, { sort_order: u.sort_order }),
      ),
    );
  return {
    redo: async (db) => {
      await apply(db, after);
    },
    undo: async (db) => {
      await apply(db, before);
    },
  };
}

/**
 * Create a sheet (appended to the tab bar); undo deletes it. A new sheet starts
 * empty whatever its kind — a fridge sheet gets no stages and no lines, because
 * those now belong to the sheet rather than the fridge.
 */
export function addSheetCommand(
  fridgeId: string,
  existing: Sheet[],
  values?: { name?: string; kind?: SheetKind },
): UndoCommand {
  const kind = values?.kind ?? NEW_SHEET_KIND;
  const input = {
    fridge_id: fridgeId,
    kind,
    name: values?.name ?? nextSheetName(existing, SHEET_KIND_NAME[kind]),
    sort_order: nextSheetSortOrder(existing),
  };
  let id: string | null = null;
  return {
    redo: async (db) => {
      id = (await sheetsRepo(db).create(input)).id;
    },
    undo: async (db) => {
      if (id) await sheetsRepo(db).remove(id);
    },
  };
}

/** Everything drawn on a sheet, captured so a delete can be undone. */
export interface SheetContents {
  stages: Stage[];
  lines: Line[];
  components: Component[];
  connections: Connection[];
}

/**
 * Delete a sheet with everything drawn on it; undo re-creates all five layers,
 * remapping foreign keys onto the fresh rows. A fridge sheet takes its own
 * stages and lines with it (they are sheet-scoped); a room-temp
 * sheet simply has none.
 *
 * Postgres would cascade the children, but the deletes are issued explicitly:
 * the in-memory test fake doesn't cascade, and being explicit keeps the undo
 * symmetric with what redo actually removed. Order matters on the way back:
 * stages and lines before the components that reference them, components before
 * the connections that join them.
 */
export function deleteSheetCommand(
  sheet: Sheet,
  contents: SheetContents,
): UndoCommand {
  const { stages, lines, components, connections } = contents;
  let currentId = sheet.id;
  return {
    redo: async (db) => {
      await connectionsRepo(db).removeBySheet(currentId);
      await componentsRepo(db).removeBySheet(currentId);
      await linesRepo(db).removeBySheet(currentId);
      await stagesRepo(db).removeBySheet(currentId);
      await sheetsRepo(db).remove(currentId);
    },
    undo: async (db) => {
      const recreated = await sheetsRepo(db).create({
        fridge_id: sheet.fridge_id,
        kind: sheet.kind,
        name: sheet.name,
        sort_order: sheet.sort_order,
        notes: sheet.notes,
      });
      currentId = recreated.id;

      // Each layer comes back with fresh ids, so everything pointing at it has
      // to be re-pointed. A row that lost a referent is dropped rather than
      // resurrected dangling.
      const stageIdMap = new Map<string, string>();
      for (const stage of stages) {
        const fresh = await stagesRepo(db).create({
          fridge_id: stage.fridge_id ?? sheet.fridge_id,
          sheet_id: recreated.id,
          name: stage.name,
          nominal_temp: stage.nominal_temp,
          color: stage.color,
          sort_order: stage.sort_order,
          height_px: stage.height_px,
          hidden: stage.hidden,
          locked: stage.locked,
        });
        stageIdMap.set(stage.id, fresh.id);
      }

      const lineIdMap = new Map<string, string>();
      for (const line of lines) {
        const fresh = await linesRepo(db).create({
          fridge_id: line.fridge_id ?? sheet.fridge_id,
          sheet_id: recreated.id,
          name: line.name,
          line_type: line.line_type,
          direction: line.direction,
          status: line.status,
          notes: line.notes,
          sort_order: line.sort_order,
          width_px: line.width_px,
          show_label: line.show_label,
        });
        lineIdMap.set(line.id, fresh.id);
      }

      const componentIdMap = new Map<string, string>();
      for (const component of components) {
        const fresh = await recreateComponent(db, component, {
          sheet_id: recreated.id,
          stage_id: component.stage_id
            ? (stageIdMap.get(component.stage_id) ?? null)
            : null,
          line_id: component.line_id
            ? (lineIdMap.get(component.line_id) ?? null)
            : null,
        });
        componentIdMap.set(component.id, fresh.id);
      }

      const remapped = connections
        .map((conn) => {
          const from = componentIdMap.get(conn.from_component_id);
          const to = componentIdMap.get(conn.to_component_id);
          if (!from || !to) return null;
          return {
            fridge_id: conn.fridge_id ?? sheet.fridge_id,
            sheet_id: recreated.id,
            from_component_id: from,
            from_port_side: conn.from_port_side,
            from_port_index: conn.from_port_index,
            to_component_id: to,
            to_port_side: conn.to_port_side,
            to_port_index: conn.to_port_index,
          };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null);
      if (remapped.length) await connectionsRepo(db).createMany(remapped);
    },
  };
}

/** Create an explicit port-to-port connection; undo removes the created row. */
export function addConnectionCommand(
  input: ConnectionCreateInput,
): UndoCommand {
  let id: string | null = null;
  return {
    redo: async (db) => {
      id = (await connectionsRepo(db).create(input)).id;
    },
    undo: async (db) => {
      if (id) await connectionsRepo(db).remove(id);
    },
  };
}

/** Delete a connection; undo re-creates it (with a fresh id, same endpoints). */
export function deleteConnectionCommand(connection: Connection): UndoCommand {
  const input: ConnectionCreateInput = {
    fridge_id: connection.fridge_id ?? "",
    from_component_id: connection.from_component_id,
    from_port_side: connection.from_port_side,
    from_port_index: connection.from_port_index,
    to_component_id: connection.to_component_id,
    to_port_side: connection.to_port_side,
    to_port_index: connection.to_port_index,
  };
  let currentId = connection.id;
  return {
    optimisticRedo: (state) => withoutConnection(state, currentId),
    redo: async (db) => {
      await connectionsRepo(db).remove(currentId);
    },
    undo: async (db) => {
      currentId = (await connectionsRepo(db).create(input)).id;
    },
  };
}

/** Create a text annotation; undo removes the created row. */
export function addAnnotationCommand(
  input: AnnotationCreateInput,
): UndoCommand {
  let id: string | null = null;
  return {
    redo: async (db) => {
      id = (await annotationsRepo(db).create(input)).id;
    },
    undo: async (db) => {
      if (id) await annotationsRepo(db).remove(id);
    },
  };
}

/** Delete an annotation; undo re-creates it (fresh id, same text and position). */
export function deleteAnnotationCommand(annotation: Annotation): UndoCommand {
  const input: AnnotationCreateInput = {
    fridge_id: annotation.fridge_id,
    sheet_id: annotation.sheet_id,
    text: annotation.text,
    x_abs: annotation.x_abs,
    y_abs: annotation.y_abs,
  };
  let currentId = annotation.id;
  return {
    redo: async (db) => {
      await annotationsRepo(db).remove(currentId);
    },
    undo: async (db) => {
      currentId = (await annotationsRepo(db).create(input)).id;
    },
  };
}

/** Edit an annotation's text or position; reversible. */
export function annotationPatchCommand(
  id: string,
  before: AnnotationUpdateInput,
  after: AnnotationUpdateInput,
): UndoCommand {
  return patchCommand(
    (db, patch) =>
      annotationsRepo(db).update(id, patch as AnnotationUpdateInput),
    before,
    after,
  );
}
