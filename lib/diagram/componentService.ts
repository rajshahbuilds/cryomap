import type { Component, Rotation } from "@/lib/types";
import { componentsRepo, type Db } from "@/lib/repositories";
import { targetToPosition, type PlacementTarget } from "./placement";

/** Move a component to a resolved placement target (stage-pinned or free). */
export async function moveComponentTo(
  db: Db,
  id: string,
  target: PlacementTarget,
): Promise<Component> {
  return componentsRepo(db).update(id, targetToPosition(target));
}

/** A component's position columns, for restoring on undo. */
export interface ComponentPosition {
  line_id: string | null;
  stage_id: string | null;
  free_floating: boolean;
  x_abs: number | null;
  y_abs: number | null;
}

/** Restore a component's exact position columns (for undoing a move). */
export async function setComponentPosition(
  db: Db,
  id: string,
  position: ComponentPosition,
): Promise<Component> {
  return componentsRepo(db).update(id, position);
}

/** Re-parent a component onto a line×stage intersection. */
export async function moveComponentToLineStage(
  db: Db,
  id: string,
  lineId: string,
  stageId: string,
): Promise<Component> {
  return componentsRepo(db).update(id, {
    line_id: lineId,
    stage_id: stageId,
    free_floating: false,
    x_abs: null,
    y_abs: null,
  });
}

/** Move a free-floating component to absolute coords. */
export async function moveComponentFree(
  db: Db,
  id: string,
  x: number,
  y: number,
): Promise<Component> {
  return componentsRepo(db).update(id, {
    free_floating: true,
    x_abs: x,
    y_abs: y,
  });
}

export async function rotateComponent(
  db: Db,
  id: string,
  rotation: Rotation,
): Promise<Component> {
  return componentsRepo(db).update(id, { rotation });
}

export async function mirrorComponent(
  db: Db,
  id: string,
  mirrored: boolean,
): Promise<Component> {
  return componentsRepo(db).update(id, { mirrored });
}

export async function deleteComponent(db: Db, id: string): Promise<void> {
  return componentsRepo(db).remove(id);
}

/** Build a create payload copying a component, with explicit absolute coords. */
function copyInput(c: Component, xAbs: number | null, yAbs: number | null) {
  if (!c.fridge_id) throw new Error("Cannot copy a component with no fridge");
  return {
    fridge_id: c.fridge_id,
    // A copy stays on the sheet it was copied from.
    sheet_id: c.sheet_id,
    component_type: c.component_type,
    line_id: c.line_id,
    stage_id: c.stage_id,
    linked_line_id: c.linked_line_id,
    custom_def_id: c.custom_def_id,
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
    x_abs: xAbs,
    y_abs: yAbs,
  };
}

/** Duplicate a component, nudging the copy so it doesn't sit exactly on top. */
export async function duplicateComponent(
  db: Db,
  component: Component,
): Promise<Component> {
  const offset = 20;
  return componentsRepo(db).create(
    copyInput(
      component,
      component.x_abs != null ? component.x_abs + offset : null,
      component.y_abs != null ? component.y_abs + offset : null,
    ),
  );
}

/**
 * Re-create a component exactly (for undoing a delete). `overrides` lets a
 * caller re-point the copy onto a freshly re-created sheet/line/stage.
 */
export async function recreateComponent(
  db: Db,
  component: Component,
  overrides: {
    sheet_id?: string | null;
    line_id?: string | null;
    stage_id?: string | null;
  } = {},
): Promise<Component> {
  return componentsRepo(db).create({
    ...copyInput(component, component.x_abs, component.y_abs),
    ...overrides,
  });
}
