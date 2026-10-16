"use client";

import { useCallback, useEffect, useState } from "react";
import type { Version } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { versionsRepo } from "@/lib/repositories";

/** Load a fridge's versions (newest first), with a manual reload. */
export function useVersions(fridgeId: string): {
  versions: Version[];
  reload: () => void;
} {
  const [versions, setVersions] = useState<Version[]>([]);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const db = createSupabaseBrowserClient();
        const rows = await versionsRepo(db).listByFridge(fridgeId);
        if (active) setVersions(rows);
      } catch {
        if (active) setVersions([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [fridgeId, nonce]);

  return { versions, reload };
}
