import type { Fridge, FridgeCreateInput, FridgeUpdateInput } from "@/lib/types";
import { type Db, check, unwrap, unwrapNullable } from "./_support";

export const fridgesRepo = (db: Db) => ({
  async list(): Promise<Fridge[]> {
    const res = await db
      .from("fridges")
      .select("*")
      .order("updated_at", { ascending: false });
    return unwrap(res) as Fridge[];
  },

  async listForWorkspace(workspaceId: string): Promise<Fridge[]> {
    const res = await db
      .from("fridges")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false });
    return unwrap(res) as Fridge[];
  },

  async get(id: string): Promise<Fridge | null> {
    const res = await db.from("fridges").select("*").eq("id", id).maybeSingle();
    return unwrapNullable(res) as Fridge | null;
  },

  async create(input: FridgeCreateInput, createdBy?: string): Promise<Fridge> {
    const res = await db
      .from("fridges")
      .insert({ ...input, created_by: createdBy ?? null })
      .select()
      .single();
    return unwrap(res) as Fridge;
  },

  async update(id: string, patch: FridgeUpdateInput): Promise<Fridge> {
    const res = await db
      .from("fridges")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    return unwrap(res) as Fridge;
  },

  /** Delete a fridge (editor+ via RLS); cascades to its full diagram. */
  async delete(id: string): Promise<void> {
    const res = await db.from("fridges").delete().eq("id", id);
    check(res);
  },
});
