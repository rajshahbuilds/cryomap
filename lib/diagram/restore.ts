import type { Version } from "@/lib/types";
import { serializeSnapshot, snapshotToState } from "@/lib/types";
import {
  annotationsRepo,
  componentsRepo,
  connectionsRepo,
  customComponentDefsRepo,
  linesRepo,
  sheetsRepo,
  stagesRepo,
  versionsRepo,
  type Db,
} from "@/lib/repositories";
import { loadDiagramState } from "./load";
import { writeDiagramState } from "./writeDiagram";

/** A human label for a version (its tag, or a timestamp). */
export function versionLabel(version: Version): string {
  return version.tag ?? new Date(version.created_at).toLocaleString();
}

interface RestoreOptions {
  authorId?: string | null;
  authorName?: string | null;
}

/**
 * Restore a version: replace the fridge's live tables with the snapshot's
 * contents, then log a new "Restored from …" version. The original versions are
 * never deleted.
 */
export async function restoreVersion(
  db: Db,
  fridgeId: string,
  version: Version,
  { authorId, authorName }: RestoreOptions = {},
): Promise<void> {
  // Clear the current live diagram (connections + components first for FK
  // safety; the fake doesn't cascade, so connections are removed explicitly).
  // Sheets go last: stages, lines, components, connections, and annotations all
  // point at them.
  await connectionsRepo(db).removeByFridge(fridgeId);
  await annotationsRepo(db).removeByFridge(fridgeId);
  await componentsRepo(db).removeByFridge(fridgeId);
  await customComponentDefsRepo(db).removeByFridge(fridgeId);
  await linesRepo(db).removeByFridge(fridgeId);
  await stagesRepo(db).removeByFridge(fridgeId);
  await sheetsRepo(db).removeByFridge(fridgeId);

  // Re-create from the snapshot (fresh ids, remapped FKs).
  await writeDiagramState(db, fridgeId, snapshotToState(version.snapshot));

  // Log the restore as a new immutable version.
  const fresh = await loadDiagramState(db, fridgeId);
  await versionsRepo(db).create({
    fridge_id: fridgeId,
    snapshot: serializeSnapshot(fresh),
    commit_message: `Restored from ${versionLabel(version)}`,
    snapshot_type: version.snapshot_type,
    author_id: authorId ?? null,
    author_name: authorName ?? null,
  });
}
