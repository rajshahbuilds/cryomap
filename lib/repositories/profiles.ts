import type { Profile } from "@/lib/types";
import { type Db, unwrap, unwrapNullable } from "./_support";

export interface ProfileUpsertInput {
  id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  email?: string | null;
}

export const profilesRepo = (db: Db) => ({
  async list(): Promise<Profile[]> {
    const res = await db.from("profiles").select("*");
    return unwrap(res) as Profile[];
  },

  async get(id: string): Promise<Profile | null> {
    const res = await db
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return unwrapNullable(res) as Profile | null;
  },

  async upsert(input: ProfileUpsertInput): Promise<Profile> {
    const res = await db
      .from("profiles")
      .upsert(input, { onConflict: "id" })
      .select()
      .single();
    return unwrap(res) as Profile;
  },
});
