import type { Direction, Line, LineType } from "@/lib/types";
import { componentsRepo, linesRepo, type Db } from "@/lib/repositories";
import { nextLineSortOrder, type LineOrderUpdate } from "./lineOps";

export interface NewLineValues {
  name: string;
  lineType: LineType | null;
  direction: Direction | null;
}

/** Add a new line at the end (next sort_order) of one fridge sheet. */
export async function addLine(
  db: Db,
  fridgeId: string,
  sheetId: string,
  existing: Line[],
  values?: NewLineValues,
): Promise<Line> {
  return linesRepo(db).create({
    fridge_id: fridgeId,
    sheet_id: sheetId,
    name: values?.name ?? `Line ${existing.length + 1}`,
    line_type: values?.lineType ?? null,
    direction: values?.direction ?? null,
    sort_order: nextLineSortOrder(existing),
  });
}

export async function renameLine(
  db: Db,
  id: string,
  name: string,
): Promise<Line> {
  return linesRepo(db).update(id, { name });
}

export async function setLineType(
  db: Db,
  id: string,
  lineType: LineType | null,
): Promise<Line> {
  return linesRepo(db).update(id, { line_type: lineType });
}

export async function setLineShowLabel(
  db: Db,
  id: string,
  showLabel: boolean,
): Promise<Line> {
  return linesRepo(db).update(id, { show_label: showLabel });
}

/** Persist a reorder (the swapped sort_order pair). */
export async function applyLineOrder(
  db: Db,
  updates: LineOrderUpdate[],
): Promise<void> {
  await Promise.all(
    updates.map((update) =>
      linesRepo(db).update(update.id, { sort_order: update.sort_order }),
    ),
  );
}

/**
 * Delete a line and its components. The DB FK is `on delete set null`, which
 * would orphan components — so we cascade explicitly to avoid invisible rows.
 */
export async function deleteLineWithComponents(
  db: Db,
  lineId: string,
): Promise<void> {
  await componentsRepo(db).removeByLine(lineId);
  await linesRepo(db).remove(lineId);
}
