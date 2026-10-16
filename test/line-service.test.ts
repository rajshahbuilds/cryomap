import { describe, it, expect } from "vitest";
import {
  addLine,
  applyLineOrder,
  deleteLineWithComponents,
  setLineType,
} from "@/lib/diagram/lineService";
import { linesRepo, componentsRepo, type Db } from "@/lib/repositories";
import { createSupabaseFake, type SupabaseFake } from "./supabase-fake";
import { makeComponent, makeLine } from "./fixtures";

const asDb = (fake: SupabaseFake) => fake as unknown as Db;
const F = "00000000-0000-4000-8000-000000000001";
const SHEET = "00000000-0000-4000-8000-0000000000f1";

describe("addLine", () => {
  it("creates a line at the next sort_order", async () => {
    const fake = createSupabaseFake();
    const existing = [makeLine({ id: "l0", fridge_id: F, sort_order: 0 })];
    const line = await addLine(asDb(fake), F, SHEET, existing);
    expect(line.fridge_id).toBe(F);
    expect(line.sheet_id).toBe(SHEET);
    expect(line.sort_order).toBe(1);
  });
});

describe("setLineType", () => {
  it("sets and clears the line type", async () => {
    const fake = createSupabaseFake({
      lines: [makeLine({ id: "l1", fridge_id: F, line_type: "xy_drive" })],
    });
    await setLineType(asDb(fake), "l1", null);
    const [line] = await linesRepo(asDb(fake)).listByFridge(F);
    expect(line.line_type).toBeNull();
  });
});

describe("applyLineOrder", () => {
  it("persists swapped sort_orders", async () => {
    const fake = createSupabaseFake({
      lines: [
        makeLine({ id: "a", fridge_id: F, sort_order: 0 }),
        makeLine({ id: "b", fridge_id: F, sort_order: 1 }),
      ],
    });
    await applyLineOrder(asDb(fake), [
      { id: "a", sort_order: 1 },
      { id: "b", sort_order: 0 },
    ]);
    const lines = await linesRepo(asDb(fake)).listByFridge(F);
    expect(lines.map((l) => l.id)).toEqual(["b", "a"]); // listByFridge orders by sort_order
  });
});

describe("deleteLineWithComponents", () => {
  it("removes the line and only its own components (no orphans)", async () => {
    const fake = createSupabaseFake({
      lines: [
        makeLine({ id: "l1", fridge_id: F }),
        makeLine({ id: "l2", fridge_id: F }),
      ],
      components: [
        makeComponent({ id: "c1", fridge_id: F, line_id: "l1" }),
        makeComponent({ id: "c2", fridge_id: F, line_id: "l1" }),
        makeComponent({ id: "k1", fridge_id: F, line_id: "l2" }),
      ],
    });

    await deleteLineWithComponents(asDb(fake), "l1");

    const lines = await linesRepo(asDb(fake)).listByFridge(F);
    expect(lines.map((l) => l.id)).toEqual(["l2"]);
    const remaining = await componentsRepo(asDb(fake)).listByFridge(F);
    expect(remaining.map((c) => c.id)).toEqual(["k1"]);
  });
});
