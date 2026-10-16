"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { profilesRepo } from "@/lib/repositories";
import type { ProfileView } from "./useProfile";

/**
 * Load a single profile by user id (e.g. the holder of a lock). Returns `null`
 * while loading, when `userId` is null, or when no profile exists.
 */
export function useProfileById(userId: string | null): ProfileView | null {
  const [profile, setProfile] = useState<ProfileView | null>(null);

  useEffect(() => {
    if (!userId) return;

    let active = true;
    void (async () => {
      try {
        const db = createSupabaseBrowserClient();
        const row = await profilesRepo(db).get(userId);
        if (!active) return;
        setProfile(
          row
            ? {
                displayName: row.display_name,
                email: row.email,
                avatarUrl: row.avatar_url,
              }
            : null,
        );
      } catch {
        if (active) setProfile(null);
      }
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  return userId ? profile : null;
}
