import type {
  Annotation,
  AnnotationCreateInput,
  AnnotationUpdateInput,
} from "@/lib/types";
import { type Db, check, unwrap } from "./_support";

export const annotationsRepo = (db: Db) => ({
  async listByFridge(fridgeId: string): Promise<Annotation[]> {
    const res = await db
      .from("annotations")
      .select("*")
      .eq("fridge_id", fridgeId)
      .order("created_at", { ascending: true });
    return unwrap(res) as Annotation[];
  },

  async create(input: AnnotationCreateInput): Promise<Annotation> {
    const res = await db.from("annotations").insert(input).select().single();
    return unwrap(res) as Annotation;
  },

  async createMany(inputs: AnnotationCreateInput[]): Promise<Annotation[]> {
    if (inputs.length === 0) return [];
    const res = await db.from("annotations").insert(inputs).select();
    return unwrap(res) as Annotation[];
  },

  async update(id: string, patch: AnnotationUpdateInput): Promise<Annotation> {
    const res = await db
      .from("annotations")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    return unwrap(res) as Annotation;
  },

  async remove(id: string): Promise<void> {
    check(await db.from("annotations").delete().eq("id", id));
  },

  async removeBySheet(sheetId: string): Promise<void> {
    check(await db.from("annotations").delete().eq("sheet_id", sheetId));
  },

  async removeByFridge(fridgeId: string): Promise<void> {
    check(await db.from("annotations").delete().eq("fridge_id", fridgeId));
  },
});
