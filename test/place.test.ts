import { describe, it, expect } from "vitest";
import { createPlacedComponent } from "@/lib/diagram/place";
import type { Db } from "@/lib/repositories";
import { createSupabaseFake, type SupabaseFake } from "./supabase-fake";

const asDb = (fake: SupabaseFake) => fake as unknown as Db;
const F = "00000000-0000-4000-8000-000000000001";
const SHEET = "00000000-0000-4000-8000-000000000002";

describe("createPlacedComponent", () => {
  it("persists a built-in pinned to a stage with its default fields", async () => {
    const fake = createSupabaseFake();
    const component = await createPlacedComponent(asDb(fake), {
      fridgeId: F,
      sheetId: SHEET,
      componentType: "attenuator",
      target: {
        kind: "stage",
        stageId: "s1",
        lineId: null,
        xAbs: 400,
        yOffset: 60,
      },
    });

    expect(component).toMatchObject({
      fridge_id: F,
      component_type: "attenuator",
      stage_id: "s1",
      line_id: null,
      free_floating: false,
      x_abs: 400,
      y_abs: 60,
      value: "-20 dB", // attenuator default field
    });
    expect(fake.tables.components).toHaveLength(1);
  });

  it("persists a free (white-space) component with absolute coords", async () => {
    const fake = createSupabaseFake();
    const component = await createPlacedComponent(asDb(fake), {
      fridgeId: F,
      sheetId: SHEET,
      componentType: "custom",
      customDefId: "d1",
      target: { kind: "free", lineId: null, xAbs: 700, yAbs: 1500 },
    });

    expect(component).toMatchObject({
      component_type: "custom",
      custom_def_id: "d1",
      stage_id: null,
      free_floating: true,
      x_abs: 700,
      y_abs: 1500,
      value: null,
      label: null,
    });
  });
});
