import type { DiagramState, SheetCreateInput } from "@/lib/types";
import {
  annotationsRepo,
  componentsRepo,
  connectionsRepo,
  customComponentDefsRepo,
  linesRepo,
  sheetsRepo,
  stagesRepo,
  type Db,
} from "@/lib/repositories";

/** The sheet a pre-sheets snapshot's rows are restored onto. */
const DEFAULT_FRIDGE_SHEET: Omit<SheetCreateInput, "fridge_id"> = {
  kind: "fridge",
  name: "Fridge wiring",
  sort_order: 0,
};

/**
 * Write a diagram state into a fridge, re-creating sheets, stages, lines, custom
 * defs, and components with fresh ids and every foreign key remapped onto them.
 * Used by fridge duplication and version restore. Each child group is
 * bulk-inserted in source order, so returned rows line up by index — that
 * pairing builds the id maps. Sheets go first: stages, lines, components, and
 * connections all point at them.
 *
 * A state with no sheets is a snapshot taken before sheets existed. Its
 * rows are fridge wiring by definition, so one `kind: "fridge"` sheet is
 * synthesized and everything lands on it — otherwise restoring an old version
 * would produce a fridge with no sheet and nothing to render.
 */
export async function writeDiagramState(
  db: Db,
  fridgeId: string,
  state: DiagramState,
  createdBy?: string,
): Promise<void> {
  const sourceSheets = state.sheets;
  const newSheets = await sheetsRepo(db).createMany(
    sourceSheets.length
      ? sourceSheets.map((s) => ({
          fridge_id: fridgeId,
          kind: s.kind,
          name: s.name,
          sort_order: s.sort_order,
          notes: s.notes,
        }))
      : [{ fridge_id: fridgeId, ...DEFAULT_FRIDGE_SHEET }],
  );
  const sheetIdMap = new Map(
    sourceSheets.map((s, i) => [s.id, newSheets[i].id]),
  );
  // Where a row's sheet_id is null (pre-sheets) or dangling, it belongs to the
  // fridge sheet — the only diagram that existed before sheets.
  const fallbackSheetId =
    newSheets.find((s) => s.kind === "fridge")?.id ?? newSheets[0].id;
  const remapSheet = (sheetId: string | null) =>
    (sheetId ? sheetIdMap.get(sheetId) : null) ?? fallbackSheetId;

  const newStages = state.stages.length
    ? await stagesRepo(db).createMany(
        state.stages.map((s) => ({
          fridge_id: fridgeId,
          sheet_id: remapSheet(s.sheet_id),
          name: s.name,
          nominal_temp: s.nominal_temp,
          color: s.color,
          sort_order: s.sort_order,
          height_px: s.height_px,
          hidden: s.hidden,
          locked: s.locked,
        })),
      )
    : [];
  const stageIdMap = new Map(
    state.stages.map((s, i) => [s.id, newStages[i].id]),
  );

  const newLines = state.lines.length
    ? await linesRepo(db).createMany(
        state.lines.map((l) => ({
          fridge_id: fridgeId,
          sheet_id: remapSheet(l.sheet_id),
          name: l.name,
          line_type: l.line_type,
          direction: l.direction,
          status: l.status,
          notes: l.notes,
          sort_order: l.sort_order,
          width_px: l.width_px,
          show_label: l.show_label,
        })),
      )
    : [];
  const lineIdMap = new Map(state.lines.map((l, i) => [l.id, newLines[i].id]));

  const newDefs = state.customDefs.length
    ? await customComponentDefsRepo(db).createMany(
        state.customDefs.map((d) => ({
          fridge_id: fridgeId,
          name: d.name,
          width_px: d.width_px,
          height_px: d.height_px,
          ports: d.ports,
          extra_field_keys: d.extra_field_keys,
        })),
        createdBy,
      )
    : [];
  const defIdMap = new Map(
    state.customDefs.map((d, i) => [d.id, newDefs[i].id]),
  );

  const newComponents = state.components.length
    ? await componentsRepo(db).createMany(
        state.components.map((c) => ({
          fridge_id: fridgeId,
          sheet_id: remapSheet(c.sheet_id),
          line_id: c.line_id ? (lineIdMap.get(c.line_id) ?? null) : null,
          stage_id: c.stage_id ? (stageIdMap.get(c.stage_id) ?? null) : null,
          linked_line_id: c.linked_line_id
            ? (lineIdMap.get(c.linked_line_id) ?? null)
            : null,
          component_type: c.component_type,
          custom_def_id: c.custom_def_id
            ? (defIdMap.get(c.custom_def_id) ?? null)
            : null,
          label: c.label,
          value: c.value,
          manufacturer: c.manufacturer,
          part_number: c.part_number,
          serial_number: c.serial_number,
          frequency_range: c.frequency_range,
          power_rating: c.power_rating,
          datasheet_url: c.datasheet_url,
          notes: c.notes,
          extra_fields: c.extra_fields,
          x_offset: c.x_offset,
          rotation: c.rotation,
          mirrored: c.mirrored,
          free_floating: c.free_floating,
          x_abs: c.x_abs,
          y_abs: c.y_abs,
        })),
      )
    : [];
  const componentIdMap = new Map(
    state.components.map((c, i) => [c.id, newComponents[i].id]),
  );

  // Connections reference two components by id — remap onto the fresh rows and
  // drop any whose endpoints didn't survive.
  const connections = (state.connections ?? [])
    .map((conn) => {
      const from = componentIdMap.get(conn.from_component_id);
      const to = componentIdMap.get(conn.to_component_id);
      if (!from || !to) return null;
      return {
        fridge_id: fridgeId,
        sheet_id: remapSheet(conn.sheet_id),
        from_component_id: from,
        from_port_side: conn.from_port_side,
        from_port_index: conn.from_port_index,
        to_component_id: to,
        to_port_side: conn.to_port_side,
        to_port_index: conn.to_port_index,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);
  await connectionsRepo(db).createMany(connections);

  // Annotations reference only their sheet — remap it and re-create.
  if (state.annotations.length) {
    await annotationsRepo(db).createMany(
      state.annotations.map((a) => ({
        fridge_id: fridgeId,
        sheet_id: remapSheet(a.sheet_id),
        text: a.text,
        x_abs: a.x_abs,
        y_abs: a.y_abs,
      })),
    );
  }
}
