import { describe, it, expect } from "vitest";
import { duplicateFridge } from "@/lib/fridges/duplicate";
import {
  componentsRepo,
  customComponentDefsRepo,
  fridgesRepo,
  linesRepo,
  stagesRepo,
  type Db,
} from "@/lib/repositories";
import { createSupabaseFake, type SupabaseFake } from "./supabase-fake";
import {
  makeComponent,
  makeCustomComponentDef,
  makeFridge,
  makeLine,
  makeStage,
} from "./fixtures";

const asDb = (fake: SupabaseFake) => fake as unknown as Db;
const SRC = "00000000-0000-4000-8000-000000000001";

function seedFridge() {
  const stage = makeStage({ id: "stage-src", fridge_id: SRC, name: "MXC" });
  const line = makeLine({ id: "line-src", fridge_id: SRC, name: "Q1" });
  const def = makeCustomComponentDef({ id: "def-src", fridge_id: SRC });
  const component = makeComponent({
    id: "comp-src",
    fridge_id: SRC,
    stage_id: stage.id,
    line_id: line.id,
    component_type: "custom",
    custom_def_id: def.id,
    label: "C1",
  });

  return createSupabaseFake({
    fridges: [makeFridge({ id: SRC, name: "DR-1" })],
    stages: [stage],
    lines: [line],
    custom_component_defs: [def],
    components: [component],
  });
}

describe("duplicateFridge", () => {
  it("creates a 'Copy of' fridge owned by the duplicator", async () => {
    const fake = seedFridge();
    const copy = await duplicateFridge(asDb(fake), SRC, "user-2");

    expect(copy.name).toBe("Copy of DR-1");
    expect(copy.id).not.toBe(SRC);
    expect(copy.archived).toBe(false);
    expect(copy.created_by).toBe("user-2");
  });

  it("deep-copies children and remaps the component's foreign keys", async () => {
    const fake = seedFridge();
    const copy = await duplicateFridge(asDb(fake), SRC, "user-2");
    const db = asDb(fake);

    const [stages, lines, defs, components] = await Promise.all([
      stagesRepo(db).listByFridge(copy.id),
      linesRepo(db).listByFridge(copy.id),
      customComponentDefsRepo(db).listByFridge(copy.id),
      componentsRepo(db).listByFridge(copy.id),
    ]);

    expect(stages).toHaveLength(1);
    expect(lines).toHaveLength(1);
    expect(defs).toHaveLength(1);
    expect(components).toHaveLength(1);

    const component = components[0];
    // Copied content is preserved...
    expect(component.label).toBe("C1");
    // ...but the foreign keys point at the NEW rows, not the originals.
    expect(component.stage_id).toBe(stages[0].id);
    expect(component.line_id).toBe(lines[0].id);
    expect(component.custom_def_id).toBe(defs[0].id);
    expect(component.stage_id).not.toBe("stage-src");
    expect(component.line_id).not.toBe("line-src");
    expect(component.custom_def_id).not.toBe("def-src");
  });

  it("leaves the source fridge untouched (independent copy)", async () => {
    const fake = seedFridge();
    await duplicateFridge(asDb(fake), SRC, "user-2");

    const sourceStages = await stagesRepo(asDb(fake)).listByFridge(SRC);
    expect(sourceStages).toHaveLength(1);
    expect(sourceStages[0].id).toBe("stage-src");
    expect(await fridgesRepo(asDb(fake)).list()).toHaveLength(2);
  });

  it("throws when the source fridge does not exist", async () => {
    const fake = createSupabaseFake();
    await expect(duplicateFridge(asDb(fake), "missing")).rejects.toThrow();
  });
});
