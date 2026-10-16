import { describe, it, expect } from "vitest";
import { createSupabaseFake, type FakeRow } from "./supabase-fake";
import { makeStage } from "./fixtures";

describe("createSupabaseFake", () => {
  it("inserts a row and reads it back by filter", async () => {
    const db = createSupabaseFake();

    await db.from("stages").insert(makeStage({ name: "MXC" }));
    const { data, error } = await db
      .from("stages")
      .select("*")
      .eq("name", "MXC");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("orders rows and returns a single record", async () => {
    const db = createSupabaseFake({
      stages: [
        makeStage({ name: "B", sort_order: 2 }),
        makeStage({ name: "A", sort_order: 1 }),
      ],
    });

    const { data } = await db
      .from("stages")
      .select("*")
      .order("sort_order", { ascending: true })
      .maybeSingle();

    expect((data as FakeRow).name).toBe("A");
  });

  it("updates matching rows in place", async () => {
    const db = createSupabaseFake({ stages: [makeStage({ name: "Still" })] });

    await db.from("stages").update({ height_px: 200 }).eq("name", "Still");

    expect(db.tables.stages[0].height_px).toBe(200);
  });

  it("deletes matching rows", async () => {
    const db = createSupabaseFake({
      stages: [makeStage({ name: "4K" }), makeStage({ name: "50K" })],
    });

    await db.from("stages").delete().eq("name", "4K");

    expect(db.tables.stages).toHaveLength(1);
    expect(db.tables.stages[0].name).toBe("50K");
  });

  it("seeds are isolated from the store (no shared references)", async () => {
    const seed = makeStage({ name: "Cold Plate" });
    const db = createSupabaseFake({ stages: [seed] });

    await db
      .from("stages")
      .update({ name: "changed" })
      .eq("name", "Cold Plate");

    expect(seed.name).toBe("Cold Plate");
  });
});
