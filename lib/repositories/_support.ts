import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

/**
 * The repository layer is the single seam between feature code and Supabase.
 * Every repo is a factory `xRepo(db)` taking a typed client; nothing outside
 * `lib/repositories` should call `db.from(...)` directly. In tests, pass the
 * in-memory fake (`test/supabase-fake`) cast to `Db`.
 */
export type Db = SupabaseClient<Database>;

type PostgrestLike<T> = { data: T | null; error: { message: string } | null };

export class RepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryError";
  }
}

/** Throw on error; return the (non-null) data — for lists, inserts, single(). */
export function unwrap<T>(result: PostgrestLike<T>): T {
  if (result.error) throw new RepositoryError(result.error.message);
  return result.data as T;
}

/** Throw on error; return data or null — for maybeSingle() lookups. */
export function unwrapNullable<T>(result: PostgrestLike<T>): T | null {
  if (result.error) throw new RepositoryError(result.error.message);
  return result.data;
}

/** Throw on error; return nothing — for deletes. */
export function check(result: { error: { message: string } | null }): void {
  if (result.error) throw new RepositoryError(result.error.message);
}
