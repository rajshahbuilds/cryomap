import type { Line, LineCreateInput, LineUpdateInput } from "@/lib/types";
import { type Db, check, unwrap } from "./_support";

export const linesRepo = (db: Db) => ({
  async listByFridge(fridgeId: string): Promise<Line[]> {
    const res = await db
      .from("lines")
      .select("*")
      .eq("fridge_id", fridgeId)
      .order("sort_order", { ascending: true });
    return unwrap(res) as Line[];
  },

  // Snapshot-compatible inputs allow missing sheet ids; live writes are
  // constrained by the database NOT NULL check. Restore remaps them first.
  async create(input: LineCreateInput, id?: string): Promise<Line> {
    const res = await db
      .from("lines")
      .insert({
        ...input,
        direction: input.direction ?? "input",
        ...(id ? { id } : {}),
        sheet_id: input.sheet_id!,
      })
      .select()
      .single();
    return unwrap(res) as Line;
  },

  async createMany(inputs: LineCreateInput[]): Promise<Line[]> {
    const res = await db
      .from("lines")
      .insert(
        inputs.map((input) => ({
          ...input,
          direction: input.direction ?? "input",
          sheet_id: input.sheet_id!,
        })),
      )
      .select();
    return unwrap(res) as Line[];
  },

  async update(id: string, patch: LineUpdateInput): Promise<Line> {
    const { sheet_id, ...values } = patch;
    const res = await db
      .from("lines")
      .update({ ...values, ...(sheet_id != null ? { sheet_id } : {}) })
      .eq("id", id)
      .select()
      .single();
    return unwrap(res) as Line;
  },

  async remove(id: string): Promise<void> {
    check(await db.from("lines").delete().eq("id", id));
  },

  async removeByFridge(fridgeId: string): Promise<void> {
    check(await db.from("lines").delete().eq("fridge_id", fridgeId));
  },

  async removeBySheet(sheetId: string): Promise<void> {
    check(await db.from("lines").delete().eq("sheet_id", sheetId));
  },
});
