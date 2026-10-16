import { describe, it, expect } from "vitest";
import {
  extraFieldRows,
  defToFormValues,
  customDefUsageCount,
} from "@/lib/diagram/customDef";
import {
  addCustomDefCommand,
  customDefPatchCommand,
  deleteCustomDefCommand,
} from "@/lib/diagram/editCommands";
import { assembleDiagram } from "@/lib/diagram/assemble";
import type { Db } from "@/lib/repositories";
import { createSupabaseFake, type SupabaseFake } from "./supabase-fake";
import { makeComponent, makeCustomComponentDef } from "./fixtures";

const asDb = (fake: SupabaseFake) => fake as unknown as Db;
const F = "00000000-0000-4000-8000-000000000001";

describe("extraFieldRows", () => {
  it("lists a row per def key, filled from the instance", () => {
    const def = makeCustomComponentDef({ extra_field_keys: ["gain", "model"] });
    expect(extraFieldRows(def, { gain: "20 dB" })).toEqual([
      { key: "gain", value: "20 dB" },
      { key: "model", value: "" },
    ]);
  });

  it("is empty when the def has no extra keys", () => {
    expect(
      extraFieldRows(makeCustomComponentDef({ extra_field_keys: null }), {}),
    ).toEqual([]);
  });
});

describe("custom def commands", () => {
  it("creates a def on redo and removes it on undo", async () => {
    const fake = createSupabaseFake();
    const cmd = addCustomDefCommand(
      { fridge_id: F, name: "Splitter", width_px: 100, height_px: 60 },
      "user-1",
    );
    await cmd.redo(asDb(fake));
    expect(fake.tables.custom_component_defs).toHaveLength(1);
    await cmd.undo(asDb(fake));
    expect(fake.tables.custom_component_defs).toHaveLength(0);
  });

  it("patches a def and reverses it", async () => {
    const fake = createSupabaseFake({
      custom_component_defs: [
        makeCustomComponentDef({
          id: "d1",
          fridge_id: F,
          name: "Old",
          width_px: 80,
        }),
      ],
    });
    const cmd = customDefPatchCommand(
      "d1",
      { name: "Old", width_px: 80 },
      { name: "New", width_px: 140 },
    );
    await cmd.redo(asDb(fake));
    expect(fake.tables.custom_component_defs[0]).toMatchObject({
      name: "New",
      width_px: 140,
    });
    await cmd.undo(asDb(fake));
    expect(fake.tables.custom_component_defs[0]).toMatchObject({
      name: "Old",
      width_px: 80,
    });
  });

  it("deletes a def on redo and re-creates it on undo", async () => {
    const fake = createSupabaseFake({
      custom_component_defs: [
        makeCustomComponentDef({ id: "d1", fridge_id: F, name: "Splitter" }),
      ],
    });
    const cmd = deleteCustomDefCommand(
      makeCustomComponentDef({ id: "d1", fridge_id: F, name: "Splitter" }),
    );
    await cmd.redo(asDb(fake));
    expect(fake.tables.custom_component_defs).toHaveLength(0);
    await cmd.undo(asDb(fake));
    expect(fake.tables.custom_component_defs).toHaveLength(1);
    expect(fake.tables.custom_component_defs[0]).toMatchObject({
      name: "Splitter",
      fridge_id: F,
    });
  });
});

describe("customDefUsageCount", () => {
  it("counts placed components that reference the def", () => {
    const components = [
      makeComponent({ id: "a", component_type: "custom", custom_def_id: "d1" }),
      makeComponent({ id: "b", component_type: "custom", custom_def_id: "d1" }),
      makeComponent({ id: "c", component_type: "custom", custom_def_id: "d2" }),
      makeComponent({
        id: "e",
        component_type: "attenuator",
        custom_def_id: null,
      }),
    ];
    expect(customDefUsageCount(components, "d1")).toBe(2);
    expect(customDefUsageCount(components, "d2")).toBe(1);
    expect(customDefUsageCount(components, "d3")).toBe(0);
  });
});

describe("def → instance propagation", () => {
  it("instances render from the (shared) updated def", () => {
    const def = makeCustomComponentDef({
      id: "d1",
      fridge_id: F,
      width_px: 200,
    });
    const view = assembleDiagram({
      sheets: [],
      stages: [],
      lines: [],
      components: [
        makeComponent({
          id: "c1",
          fridge_id: F,
          component_type: "custom",
          custom_def_id: "d1",
          free_floating: true,
          x_abs: 10,
          y_abs: 10,
        }),
      ],
      customDefs: [def],
      connections: [],
      annotations: [],
    });
    // The positioned instance resolves to the shared def — editing the def
    // (a single row) changes every instance's rendering on reload.
    expect(view.customDefById.get("d1")?.width_px).toBe(200);
    expect(view.positioned[0].component.custom_def_id).toBe("d1");
  });
});

describe("defToFormValues", () => {
  it("seeds the modal form, defaulting null extra keys to []", () => {
    const def = makeCustomComponentDef({
      name: "X",
      width_px: 90,
      height_px: 50,
      extra_field_keys: null,
    });
    expect(defToFormValues(def)).toMatchObject({
      name: "X",
      width_px: 90,
      height_px: 50,
      extra_field_keys: [],
    });
  });
});
