import type { Sheet, SheetCreateInput, SheetUpdateInput } from "@/lib/types";
import { type Db, check, unwrap } from "./_support";

export const sheetsRepo = (db: Db) => ({
  async listByFridge(fridgeId: string): Promise<Sheet[]> {
    const res = await db
      .from("sheets")
      .select("*")
      .eq("fridge_id", fridgeId)
      .order("sort_order", { ascending: true });
    return unwrap(res) as Sheet[];
  },

  async create(input: SheetCreateInput): Promise<Sheet> {
    const res = await db.from("sheets").insert(input).select().single();
    return unwrap(res) as Sheet;
  },

  async createMany(inputs: SheetCreateInput[]): Promise<Sheet[]> {
    const res = await db.from("sheets").insert(inputs).select();
    return unwrap(res) as Sheet[];
  },

  async update(id: string, patch: SheetUpdateInput): Promise<Sheet> {
    const res = await db
      .from("sheets")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    return unwrap(res) as Sheet;
  },

  /**
   * Deleting a sheet cascades to its components and connections (FK
   * `on delete cascade`). Callers must refuse to delete the `kind: "fridge"`
   * sheet — it owns the diagram every fridge is expected to have.
   */
  async remove(id: string): Promise<void> {
    check(await db.from("sheets").delete().eq("id", id));
  },

  async removeByFridge(fridgeId: string): Promise<void> {
    check(await db.from("sheets").delete().eq("fridge_id", fridgeId));
  },
});
