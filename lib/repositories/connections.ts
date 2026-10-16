import type { Connection, ConnectionCreateInput } from "@/lib/types";
import { type Db, check, unwrap } from "./_support";

export const connectionsRepo = (db: Db) => ({
  async listByFridge(fridgeId: string): Promise<Connection[]> {
    const res = await db
      .from("connections")
      .select("*")
      .eq("fridge_id", fridgeId)
      .order("created_at", { ascending: true });
    return unwrap(res) as Connection[];
  },

  async create(input: ConnectionCreateInput): Promise<Connection> {
    const res = await db.from("connections").insert(input).select().single();
    return unwrap(res) as Connection;
  },

  async createMany(inputs: ConnectionCreateInput[]): Promise<Connection[]> {
    if (inputs.length === 0) return [];
    const res = await db.from("connections").insert(inputs).select();
    return unwrap(res) as Connection[];
  },

  async remove(id: string): Promise<void> {
    check(await db.from("connections").delete().eq("id", id));
  },

  async removeBySheet(sheetId: string): Promise<void> {
    check(await db.from("connections").delete().eq("sheet_id", sheetId));
  },

  async removeByFridge(fridgeId: string): Promise<void> {
    check(await db.from("connections").delete().eq("fridge_id", fridgeId));
  },
});
