import type { DiagramState } from "@/lib/types";
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

/**
 * Fetch a fridge's full live diagram state via the repositories — **every
 * sheet**, not just the visible one. Snapshotting captures the whole fridge, and
 * cross-sheet signal tracing (a bench chain terminating at a fridge line) needs
 * both sides loaded at once. `assembleDiagram` narrows to a single sheet for
 * rendering.
 */
export async function loadDiagramState(
  db: Db,
  fridgeId: string,
): Promise<DiagramState> {
  const [
    sheets,
    stages,
    lines,
    components,
    customDefs,
    connections,
    annotations,
  ] = await Promise.all([
    sheetsRepo(db).listByFridge(fridgeId),
    stagesRepo(db).listByFridge(fridgeId),
    linesRepo(db).listByFridge(fridgeId),
    componentsRepo(db).listByFridge(fridgeId),
    customComponentDefsRepo(db).listByFridge(fridgeId),
    connectionsRepo(db).listByFridge(fridgeId),
    annotationsRepo(db).listByFridge(fridgeId),
  ]);
  return {
    sheets,
    stages,
    lines,
    components,
    customDefs,
    connections,
    annotations,
  };
}
