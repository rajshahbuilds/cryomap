import type { Lock, LockCreateInput } from "@/lib/types";
import { type Db, check, unwrap, unwrapNullable } from "./_support";

export const locksRepo = (db: Db) => ({
  async list(): Promise<Lock[]> {
    const res = await db.from("locks").select("*");
    return unwrap(res) as Lock[];
  },

  async get(fridgeId: string): Promise<Lock | null> {
    const res = await db
      .from("locks")
      .select("*")
      .eq("fridge_id", fridgeId)
      .maybeSingle();
    return unwrapNullable(res) as Lock | null;
  },

  /** Acquire (or refresh) the lock for a fridge — one row per fridge. */
  async acquire(input: LockCreateInput): Promise<Lock> {
    const res = await db
      .from("locks")
      .upsert(
        { ...input, locked_at: new Date().toISOString() },
        {
          onConflict: "fridge_id",
        },
      )
      .select()
      .single();
    return unwrap(res) as Lock;
  },

  async release(fridgeId: string): Promise<void> {
    check(await db.from("locks").delete().eq("fridge_id", fridgeId));
  },
});
