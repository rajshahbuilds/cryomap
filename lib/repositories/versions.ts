import type { Json, Version, VersionCreateInput } from "@/lib/types";
import { type Db, unwrap, unwrapNullable } from "./_support";

export const versionsRepo = (db: Db) => ({
  async listByFridge(fridgeId: string): Promise<Version[]> {
    const res = await db
      .from("versions")
      .select("*")
      .eq("fridge_id", fridgeId)
      .order("created_at", { ascending: false });
    return unwrap(res) as Version[];
  },

  async get(id: string): Promise<Version | null> {
    const res = await db
      .from("versions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return unwrapNullable(res) as Version | null;
  },

  async create(input: VersionCreateInput): Promise<Version> {
    const res = await db
      .from("versions")
      .insert({
        fridge_id: input.fridge_id,
        // `snapshot` is a jsonb column typed as `Json` by the generated client.
        snapshot: input.snapshot as unknown as Json,
        commit_message: input.commit_message,
        tag: input.tag ?? null,
        snapshot_type: input.snapshot_type ?? "current",
        author_id: input.author_id ?? null,
        author_name: input.author_name ?? null,
      })
      .select()
      .single();
    return unwrap(res) as Version;
  },
});
