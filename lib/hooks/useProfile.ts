"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { profilesRepo } from "@/lib/repositories";

/** The display-only shape the UserMenu needs. */
export interface ProfileView {
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
}

/**
 * Load the signed-in user's profile for presentational components. Reads the
 * `profiles` row, falling back to auth metadata so the menu still renders if the
 * row is momentarily missing (e.g. the upsert hasn't landed yet).
 */
export function useProfile(): {
  profile: ProfileView | null;
  loading: boolean;
} {
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (active) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      const meta = user.user_metadata ?? {};
      const row = await profilesRepo(supabase).get(user.id);
      if (!active) return;

      setProfile({
        displayName:
          row?.display_name ??
          (meta.full_name as string | undefined) ??
          (meta.name as string | undefined) ??
          null,
        email: row?.email ?? user.email ?? null,
        avatarUrl:
          row?.avatar_url ?? (meta.avatar_url as string | undefined) ?? null,
      });
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  return { profile, loading };
}
