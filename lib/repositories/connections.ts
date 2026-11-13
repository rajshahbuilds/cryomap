import { wirePropertiesSchema } from "@/lib/types";
import type {
  Connection,
  ConnectionCreateInput,
  ConnectionUpdateInput,
} from "@/lib/types";
import { type Db, check, unwrap } from "./_support";

const normalize = (row: Connection): Connection => ({
  ...row,
  wire_properties: wirePropertiesSchema.parse(row.wire_properties ?? {}),
});

export const connectionsRepo = (db: Db) => ({
  async listByFridge(fridgeId: string): Promise<Connection[]> {
    const res = await db
      .from("connections")
      .select("*")
      .eq("fridge_id", fridgeId)
      .order("created_at", { ascending: true });
    return (unwrap(res) as Connection[]).map(normalize);
  },

  // Historical snapshots permit missing sheet ids; live inserts are checked
  // by the database NOT NULL constraint after restore remaps the sheet.
  async create(input: ConnectionCreateInput): Promise<Connection> {
    const res = await db
      .from("connections")
      .insert({
        ...input,
        sheet_id: input.sheet_id!,
        wire_properties: wirePropertiesSchema.parse(
          input.wire_properties ?? {},
        ),
      })
      .select()
      .single();
    return normalize(unwrap(res) as Connection);
  },

  async createMany(inputs: ConnectionCreateInput[]): Promise<Connection[]> {
    if (inputs.length === 0) return [];
    const res = await db
      .from("connections")
      .insert(
        inputs.map((input) => ({
          ...input,
          sheet_id: input.sheet_id!,
          wire_properties: wirePropertiesSchema.parse(
            input.wire_properties ?? {},
          ),
        })),
      )
      .select();
    return (unwrap(res) as Connection[]).map(normalize);
  },

  async update(id: string, patch: ConnectionUpdateInput): Promise<Connection> {
    const values =
      patch.wire_properties === undefined
        ? {}
        : {
            wire_properties: wirePropertiesSchema.parse(patch.wire_properties),
          };
    const res = await db
      .from("connections")
      .update(values)
      .eq("id", id)
      .select()
      .single();
    return normalize(unwrap(res) as Connection);
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
