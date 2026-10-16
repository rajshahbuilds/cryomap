import { describe, it, expect } from "vitest";
import { loadDiagramState } from "@/lib/diagram/load";
import { assembleDiagram } from "@/lib/diagram/assemble";
import type { Db } from "@/lib/repositories";
import { createSupabaseFake, type SupabaseFake } from "./supabase-fake";
import {
  makeComponent,
  makeCustomComponentDef,
  makeLine,
  makeSheet,
  makeStage,
} from "./fixtures";

const asDb = (fake: SupabaseFake) => fake as unknown as Db;
const F = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-0000000000ff";

describe("loadDiagramState", () => {
  it("loads only the requested fridge's stages/lines/components/defs", async () => {
    const fake = createSupabaseFake({
      stages: [
        makeStage({ id: "s1", fridge_id: F, sort_order: 0, height_px: 120 }),
        makeStage({ id: "sx", fridge_id: OTHER }),
      ],
      lines: [makeLine({ id: "lA", fridge_id: F, sort_order: 0 })],
      components: [
        makeComponent({
          id: "c1",
          fridge_id: F,
          line_id: "lA",
          stage_id: "s1",
        }),
        makeComponent({ id: "cx", fridge_id: OTHER }),
      ],
      custom_component_defs: [
        makeCustomComponentDef({ id: "d1", fridge_id: F }),
      ],
    });

    const state = await loadDiagramState(asDb(fake), F);

    expect(state.stages.map((s) => s.id)).toEqual(["s1"]);
    expect(state.lines).toHaveLength(1);
    expect(state.components.map((c) => c.id)).toEqual(["c1"]);
    expect(state.customDefs).toHaveLength(1);

    // End-to-end: loaded state assembles into a positioned, wired view.
    const view = assembleDiagram(state);
    expect(view.positioned).toHaveLength(1);
    expect(view.positioned[0].component.id).toBe("c1");
  });

  it("returns empty collections for a fridge with no rows", async () => {
    const state = await loadDiagramState(asDb(createSupabaseFake()), F);
    expect(state).toEqual({
      sheets: [],
      stages: [],
      lines: [],
      components: [],
      customDefs: [],
      connections: [],
      annotations: [],
    });
  });

  it("loads every sheet of the fridge, not just the rendered one", async () => {
    const fake = createSupabaseFake({
      sheets: [
        makeSheet({
          id: "sheet-rt",
          kind: "room_temp",
          name: "Bench",
          sort_order: 1,
        }),
        makeSheet({ id: "sheet-fridge", kind: "fridge", sort_order: 0 }),
        makeSheet({ id: "sheet-other", fridge_id: OTHER }),
      ],
    });

    const state = await loadDiagramState(asDb(fake), F);

    // Both of this fridge's sheets, ordered; the other fridge's is excluded.
    // Cross-sheet tracing and whole-fridge snapshots depend on this.
    expect(state.sheets.map((s) => s.id)).toEqual(["sheet-fridge", "sheet-rt"]);
  });
});
