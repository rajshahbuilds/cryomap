import type {
  Component,
  ComponentCreateInput,
  ComponentUpdateInput,
} from "@/lib/types";
import { type Db, check, unwrap } from "./_support";

export const componentsRepo = (db: Db) => ({
  async listByFridge(fridgeId: string): Promise<Component[]> {
    const res = await db
      .from("components")
      .select("*")
      .eq("fridge_id", fridgeId)
      .order("created_at", { ascending: true });
    return unwrap(res) as Component[];
  },

  // Snapshot-compatible inputs allow missing sheet ids; live writes are
  // constrained by the database NOT NULL check. Restore remaps them first.
  async create(input: ComponentCreateInput): Promise<Component> {
    const res = await db
      .from("components")
      .insert({ ...input, sheet_id: input.sheet_id! })
      .select()
      .single();
    return unwrap(res) as Component;
  },

  async createMany(inputs: ComponentCreateInput[]): Promise<Component[]> {
    const res = await db
      .from("components")
      .insert(inputs.map((input) => ({ ...input, sheet_id: input.sheet_id! })))
      .select();
    return unwrap(res) as Component[];
  },

  async update(id: string, patch: ComponentUpdateInput): Promise<Component> {
    const res = await db
      .from("components")
      .update({ ...patch, sheet_id: patch.sheet_id ?? undefined })
      .eq("id", id)
      .select()
      .single();
    return unwrap(res) as Component;
  },

  async remove(id: string): Promise<void> {
    check(await db.from("components").delete().eq("id", id));
  },

  async removeBySheet(sheetId: string): Promise<void> {
    check(await db.from("components").delete().eq("sheet_id", sheetId));
  },

  async removeByLine(lineId: string): Promise<void> {
    check(await db.from("components").delete().eq("line_id", lineId));
  },

  async removeByStage(stageId: string): Promise<void> {
    check(await db.from("components").delete().eq("stage_id", stageId));
  },

  async removeByFridge(fridgeId: string): Promise<void> {
    check(await db.from("components").delete().eq("fridge_id", fridgeId));
  },
});
