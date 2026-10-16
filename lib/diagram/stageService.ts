import type { Stage } from "@/lib/types";
import { componentsRepo, stagesRepo, type Db } from "@/lib/repositories";
import { nextStageSortOrder, type StageOrderUpdate } from "./stageOps";

export const DEFAULT_STAGE_HEIGHT = 120;

/** Add a new stage at the bottom (next sort_order) of one fridge sheet. */
export async function addStage(
  db: Db,
  fridgeId: string,
  sheetId: string,
  existing: Stage[],
): Promise<Stage> {
  return stagesRepo(db).create({
    fridge_id: fridgeId,
    sheet_id: sheetId,
    name: `Stage ${existing.length + 1}`,
    sort_order: nextStageSortOrder(existing),
    height_px: DEFAULT_STAGE_HEIGHT,
  });
}

export async function renameStage(db: Db, id: string, name: string) {
  return stagesRepo(db).update(id, { name });
}

export async function setStageTemp(
  db: Db,
  id: string,
  nominalTemp: string | null,
) {
  return stagesRepo(db).update(id, { nominal_temp: nominalTemp });
}

export async function setStageColor(db: Db, id: string, color: string | null) {
  return stagesRepo(db).update(id, { color });
}

export async function setStageHidden(db: Db, id: string, hidden: boolean) {
  return stagesRepo(db).update(id, { hidden });
}

export async function resizeStage(db: Db, id: string, heightPx: number) {
  return stagesRepo(db).update(id, { height_px: heightPx });
}

/** Persist a reorder (the swapped sort_order pair). */
export async function applyStageOrder(db: Db, updates: StageOrderUpdate[]) {
  await Promise.all(
    updates.map((u) =>
      stagesRepo(db).update(u.id, { sort_order: u.sort_order }),
    ),
  );
}

/**
 * Delete a stage and its components. The DB FK is `on delete set null`, which
 * would orphan components — so we cascade explicitly.
 */
export async function deleteStageWithComponents(db: Db, stageId: string) {
  await componentsRepo(db).removeByStage(stageId);
  await stagesRepo(db).remove(stageId);
}
