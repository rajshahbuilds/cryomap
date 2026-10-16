import type {
  CustomComponentDef,
  CustomComponentDefCreateInput,
  CustomComponentDefUpdateInput,
  Json,
} from "@/lib/types";
import { type Db, check, unwrap } from "./_support";

export const customComponentDefsRepo = (db: Db) => ({
  async listByFridge(fridgeId: string): Promise<CustomComponentDef[]> {
    const res = await db
      .from("custom_component_defs")
      .select("*")
      .eq("fridge_id", fridgeId)
      .order("created_at", { ascending: true });
    return unwrap(res) as CustomComponentDef[];
  },

  async create(
    input: CustomComponentDefCreateInput,
    createdBy?: string,
  ): Promise<CustomComponentDef> {
    const { ports, ...rest } = input;
    const res = await db
      .from("custom_component_defs")
      .insert({
        ...rest,
        created_by: createdBy ?? null,
        // `ports` is a jsonb column typed as `Json` by the generated client.
        ...(ports ? { ports: ports as unknown as Json } : {}),
      })
      .select()
      .single();
    return unwrap(res) as CustomComponentDef;
  },

  async createMany(
    inputs: CustomComponentDefCreateInput[],
    createdBy?: string,
  ): Promise<CustomComponentDef[]> {
    const rows = inputs.map(({ ports, ...rest }) => ({
      ...rest,
      created_by: createdBy ?? null,
      ...(ports ? { ports: ports as unknown as Json } : {}),
    }));
    const res = await db.from("custom_component_defs").insert(rows).select();
    return unwrap(res) as CustomComponentDef[];
  },

  async update(
    id: string,
    patch: CustomComponentDefUpdateInput,
  ): Promise<CustomComponentDef> {
    const { ports, ...rest } = patch;
    const res = await db
      .from("custom_component_defs")
      .update({
        ...rest,
        ...(ports ? { ports: ports as unknown as Json } : {}),
      })
      .eq("id", id)
      .select()
      .single();
    return unwrap(res) as CustomComponentDef;
  },

  async remove(id: string): Promise<void> {
    check(await db.from("custom_component_defs").delete().eq("id", id));
  },

  async removeByFridge(fridgeId: string): Promise<void> {
    check(
      await db.from("custom_component_defs").delete().eq("fridge_id", fridgeId),
    );
  },
});
