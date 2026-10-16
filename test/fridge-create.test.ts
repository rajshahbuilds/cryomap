import { describe, it, expect } from "vitest";
import { createFridge, parseFridgeForm } from "@/lib/fridges/create";
import { stagesRepo, type Db } from "@/lib/repositories";
import { createSupabaseFake, type SupabaseFake } from "./supabase-fake";

const asDb = (fake: SupabaseFake) => fake as unknown as Db;

const form = (entries: Record<string, string>): FormData => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
};

describe("parseFridgeForm", () => {
  it("rejects an empty name", () => {
    const result = parseFridgeForm(form({ name: "   ", vendor: "Bluefors" }));
    expect(result.success).toBe(false);
  });

  it("accepts a valid payload and drops blank optionals", () => {
    const result = parseFridgeForm(
      form({ name: "DR-2", vendor: "Bluefors", model: "", location: "Lab 3" }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("DR-2");
      expect(result.data.vendor).toBe("Bluefors");
      expect(result.data.model).toBeUndefined();
      expect(result.data.location).toBe("Lab 3");
    }
  });
});

describe("createFridge", () => {
  it("creates the fridge with no stages", async () => {
    const fake = createSupabaseFake();
    const fridge = await createFridge(asDb(fake), { name: "DR-2" }, "user-1");

    expect(fridge.name).toBe("DR-2");
    expect(fridge.created_by).toBe("user-1");

    const stages = await stagesRepo(asDb(fake)).listByFridge(fridge.id);
    expect(stages).toHaveLength(0);
  });

  it("does not seed any stages across fridges", async () => {
    const fake = createSupabaseFake();
    const a = await createFridge(asDb(fake), { name: "A" });
    const b = await createFridge(asDb(fake), { name: "B" });

    expect(await stagesRepo(asDb(fake)).listByFridge(a.id)).toHaveLength(0);
    expect(await stagesRepo(asDb(fake)).listByFridge(b.id)).toHaveLength(0);
  });
});
