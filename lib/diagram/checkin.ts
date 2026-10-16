import type { SnapshotType } from "@/lib/types";
import { serializeSnapshot } from "@/lib/types";
import { versionsRepo, type Db } from "@/lib/repositories";
import { releaseLock } from "@/lib/locks/service";
import { loadDiagramState } from "./load";

export interface CheckInInput {
  fridgeId: string;
  message: string;
  tag?: string | null;
  snapshotType?: SnapshotType;
  authorId?: string | null;
  authorName?: string | null;
}

/**
 * Check in: snapshot the live diagram into an immutable `versions` row, then
 * release the lock (returning the canvas to read-only). Re-reads the live state
 * so the snapshot is always complete.
 */
export async function checkInFridge(
  db: Db,
  input: CheckInInput,
): Promise<void> {
  const state = await loadDiagramState(db, input.fridgeId);
  const snapshot = serializeSnapshot(state);

  await versionsRepo(db).create({
    fridge_id: input.fridgeId,
    snapshot,
    commit_message: input.message,
    tag: input.tag ?? null,
    snapshot_type: input.snapshotType ?? "current",
    author_id: input.authorId ?? null,
    author_name: input.authorName ?? null,
  });

  await releaseLock(db, input.fridgeId);
}
