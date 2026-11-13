import {
  wirePropertiesSchema,
  wireSegmentEndpoints,
  type WireSegmentProperties,
  type WireSegmentPropertiesCreateInput,
  type WireSegmentPropertiesUpdateInput,
} from "@/lib/types";
import { type Db, check, unwrap } from "./_support";

const normalize = (row: WireSegmentProperties): WireSegmentProperties => ({
  ...row,
  wire_properties: wirePropertiesSchema.parse(row.wire_properties ?? {}),
});
const payload = (input: WireSegmentPropertiesCreateInput) => ({
  ...input,
  ...wireSegmentEndpoints(input.from_component_id, input.to_component_id),
  wire_properties: wirePropertiesSchema.parse(input.wire_properties ?? {}),
});

export const wireSegmentPropertiesRepo = (db: Db) => ({
  async listByFridge(fridgeId: string): Promise<WireSegmentProperties[]> {
    const res = await db
      .from("wire_segment_properties")
      .select("*")
      .eq("fridge_id", fridgeId)
      .order("created_at", { ascending: true });
    return (unwrap(res) as WireSegmentProperties[]).map(normalize);
  },
  async create(
    input: WireSegmentPropertiesCreateInput,
  ): Promise<WireSegmentProperties> {
    const res = await db
      .from("wire_segment_properties")
      .insert(payload(input))
      .select()
      .single();
    return normalize(unwrap(res) as WireSegmentProperties);
  },
  async createMany(
    inputs: WireSegmentPropertiesCreateInput[],
  ): Promise<WireSegmentProperties[]> {
    if (!inputs.length) return [];
    const res = await db
      .from("wire_segment_properties")
      .insert(inputs.map(payload))
      .select();
    return (unwrap(res) as WireSegmentProperties[]).map(normalize);
  },
  async update(
    id: string,
    patch: WireSegmentPropertiesUpdateInput,
  ): Promise<WireSegmentProperties> {
    const values =
      patch.wire_properties === undefined
        ? {}
        : {
            wire_properties: wirePropertiesSchema.parse(patch.wire_properties),
          };
    const res = await db
      .from("wire_segment_properties")
      .update(values)
      .eq("id", id)
      .select()
      .single();
    return normalize(unwrap(res) as WireSegmentProperties);
  },
  async remove(id: string): Promise<void> {
    check(await db.from("wire_segment_properties").delete().eq("id", id));
  },
  async removeBySheet(sheetId: string): Promise<void> {
    check(
      await db.from("wire_segment_properties").delete().eq("sheet_id", sheetId),
    );
  },
  async removeByFridge(fridgeId: string): Promise<void> {
    check(
      await db
        .from("wire_segment_properties")
        .delete()
        .eq("fridge_id", fridgeId),
    );
  },
});
