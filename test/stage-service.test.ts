import { describe, it, expect } from "vitest";
import {
  addStage,
  applyStageOrder,
  deleteStageWithComponents,
  setStageHidden,
} from "@/lib/diagram/stageService";
import { componentsRepo, stagesRepo, type Db } from "@/lib/repositories";
import { createSupabaseFake, type SupabaseFake } from "./supabase-fake";
import { makeComponent, makeStage } from "./fixtures";

const asDb = (fake: SupabaseFake) => fake as unknown as Db;
const F = "00000000-0000-4000-8000-000000000001";
const SHEET = "00000000-0000-4000-8000-0000000000f1";

describe("addStage", () => {
  it("creates a stage at the next sort_order", async () => {
    const fake = createSupabaseFake();
    const stage = await addStage(asDb(fake), F, SHEET, [
      makeStage({ id: "s0", fridge_id: F, sort_order: 0 }),
    ]);
    expect(stage.fridge_id).toBe(F);
    expect(stage.sheet_id).toBe(SHEET);
    expect(stage.sort_order).toBe(1);
    expect(stage.height_px).toBeGreaterThan(0);
  });
});

describe("setStageHidden / applyStageOrder", () => {
  it("hides a stage and persists a reorder", async () => {
    const fake = createSupabaseFake({
      stages: [
        makeStage({ id: "a", fridge_id: F, sort_order: 0, hidden: false }),
        makeStage({ id: "b", fridge_id: F, sort_order: 1 }),
      ],
    });
    await setStageHidden(asDb(fake), "a", true);
    await applyStageOrder(asDb(fake), [
      { id: "a", sort_order: 1 },
      { id: "b", sort_order: 0 },
    ]);

    const stages = await stagesRepo(asDb(fake)).listByFridge(F);
    expect(stages.map((s) => s.id)).toEqual(["b", "a"]); // ordered by sort_order
    expect(stages.find((s) => s.id === "a")?.hidden).toBe(true);
  });
});

describe("deleteStageWithComponents", () => {
  it("removes the stage and only its own components (no orphans)", async () => {
    const fake = createSupabaseFake({
      stages: [
        makeStage({ id: "s1", fridge_id: F }),
        makeStage({ id: "s2", fridge_id: F }),
      ],
      components: [
        makeComponent({ id: "c1", fridge_id: F, stage_id: "s1" }),
        makeComponent({ id: "k1", fridge_id: F, stage_id: "s2" }),
      ],
    });

    await deleteStageWithComponents(asDb(fake), "s1");

    const stages = await stagesRepo(asDb(fake)).listByFridge(F);
    expect(stages.map((s) => s.id)).toEqual(["s2"]);
    const components = await componentsRepo(asDb(fake)).listByFridge(F);
    expect(components.map((c) => c.id)).toEqual(["k1"]);
  });
});
