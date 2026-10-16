import type { Stage, StageCreateInput, StageUpdateInput } from "@/lib/types";
import { type Db, check, unwrap } from "./_support";

export const stagesRepo = (db: Db) => ({
  async listByFridge(fridgeId: string): Promise<Stage[]> {
    const res = await db
      .from("stages")
      .select("*")
      .eq("fridge_id", fridgeId)
      .order("sort_order", { ascending: true });
    return unwrap(res) as Stage[];
  },

  async create(input: StageCreateInput): Promise<Stage> {
    const res = await db.from("stages").insert(input).select().single();
    return unwrap(res) as Stage;
  },

  async createMany(inputs: StageCreateInput[]): Promise<Stage[]> {
    const res = await db.from("stages").insert(inputs).select();
    return unwrap(res) as Stage[];
  },

  async update(id: string, patch: StageUpdateInput): Promise<Stage> {
    const res = await db
      .from("stages")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    return unwrap(res) as Stage;
  },

  async remove(id: string): Promise<void> {
    check(await db.from("stages").delete().eq("id", id));
  },

  async removeByFridge(fridgeId: string): Promise<void> {
    check(await db.from("stages").delete().eq("fridge_id", fridgeId));
  },

  async removeBySheet(sheetId: string): Promise<void> {
    check(await db.from("stages").delete().eq("sheet_id", sheetId));
  },
});
