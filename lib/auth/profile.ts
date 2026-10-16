import type { User } from "@supabase/supabase-js";
import {
  profilesRepo,
  type Db,
  type ProfileUpsertInput,
} from "@/lib/repositories";
import type { Profile } from "@/lib/types";

const nonEmpty = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

/**
 * Derive the `profiles` row fields from a Supabase auth user. Google populates
 * `user_metadata` with `full_name`/`name`, `avatar_url`/`picture`, and the
 * email lives on the user itself.
 */
export function profileInputFromUser(user: User): ProfileUpsertInput {
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    display_name: nonEmpty(meta.full_name) ?? nonEmpty(meta.name),
    avatar_url: nonEmpty(meta.avatar_url) ?? nonEmpty(meta.picture),
    email: nonEmpty(user.email),
  };
}

/**
 * Upsert the current user's profile from their auth metadata. The DB trigger
 * (`on_auth_user_created`) seeds the row on first sign-up; this runs on every
 * sign-in so a changed Google name/avatar stays in sync — and acts as a
 * fallback should the trigger ever miss.
 */
export async function ensureProfile(db: Db, user: User): Promise<Profile> {
  return profilesRepo(db).upsert(profileInputFromUser(user));
}
