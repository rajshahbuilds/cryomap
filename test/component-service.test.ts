import { describe, it, expect } from "vitest";
import {
  deleteComponent,
  duplicateComponent,
  moveComponentFree,
  moveComponentToLineStage,
  rotateComponent,
} from "@/lib/diagram/componentService";
import { componentsRepo, type Db } from "@/lib/repositories";
import { createSupabaseFake, type SupabaseFake } from "./supabase-fake";
import { makeComponent } from "./fixtures";

const asDb = (fake: SupabaseFake) => fake as unknown as Db;
const F = "00000000-0000-4000-8000-000000000001";

const seed = () =>
  createSupabaseFake({
    components: [
      makeComponent({
        id: "c1",
        fridge_id: F,
        line_id: "lA",
        stage_id: "s1",
        rotation: 0,
        free_floating: false,
      }),
    ],
  });

const getC1 = async (fake: SupabaseFake) =>
  (await componentsRepo(asDb(fake)).listByFridge(F)).find((c) => c.id === "c1");

describe("componentService", () => {
  it("re-parents a component to a new line/stage and clears free coords", async () => {
    const fake = seed();
    await moveComponentToLineStage(asDb(fake), "c1", "lB", "s2");
    expect(await getC1(fake)).toMatchObject({
      line_id: "lB",
      stage_id: "s2",
      free_floating: false,
      x_abs: null,
      y_abs: null,
    });
  });

  it("moves a component free to absolute coords", async () => {
    const fake = seed();
    await moveComponentFree(asDb(fake), "c1", 300, 400);
    expect(await getC1(fake)).toMatchObject({
      free_floating: true,
      x_abs: 300,
      y_abs: 400,
    });
  });

  it("rotates a component", async () => {
    const fake = seed();
    await rotateComponent(asDb(fake), "c1", 90);
    expect((await getC1(fake))?.rotation).toBe(90);
  });

  it("deletes a component", async () => {
    const fake = seed();
    await deleteComponent(asDb(fake), "c1");
    expect(fake.tables.components).toHaveLength(0);
  });

  it("duplicates a component on the same line/stage", async () => {
    const fake = seed();
    const original = await getC1(fake);
    const copy = await duplicateComponent(asDb(fake), original!);
    expect(copy.id).not.toBe("c1");
    expect(copy).toMatchObject({ line_id: "lA", stage_id: "s1" });
    expect(fake.tables.components).toHaveLength(2);
  });
});
