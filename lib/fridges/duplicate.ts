import type { Fridge } from "@/lib/types";
import { fridgesRepo, type Db } from "@/lib/repositories";
import { loadDiagramState } from "@/lib/diagram/load";
import { writeDiagramState } from "@/lib/diagram/writeDiagram";

/**
 * Deep-copy a fridge into a new, independent one. Stages, lines, custom
 * component definitions, and components are all re-created with fresh ids and
 * the components' foreign keys remapped (via {@link writeDiagramState}).
 */
export async function duplicateFridge(
  db: Db,
  sourceId: string,
  createdBy?: string,
): Promise<Fridge> {
  const source = await fridgesRepo(db).get(sourceId);
  if (!source) throw new Error(`Fridge ${sourceId} not found`);

  const copy = await fridgesRepo(db).create(
    {
      name: `Copy of ${source.name}`,
      vendor: source.vendor,
      model: source.model,
      description: source.description,
      location: source.location,
      archived: false,
    },
    createdBy,
  );

  const state = await loadDiagramState(db, sourceId);
  await writeDiagramState(db, copy.id, state, createdBy);

  return copy;
}
