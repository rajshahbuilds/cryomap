"use client";

import { useCallback, useState } from "react";

export interface UseSheetsResult {
  /** The sheet the user asked for; `null` until they pick one. */
  requestedId: string | null;
  select: (id: string) => void;
}

/**
 * Owns which sheet the editor is showing — the id only, not the sheet.
 *
 * The request is held loosely and resolved against reality by
 * `assembleDiagram`, which falls back to the fridge sheet when the id matches
 * nothing. That is what keeps deleting the active tab, undoing that delete
 * (which re-creates the sheet under a *fresh* id), and rendering before the
 * fridge's sheets have loaded all pointing at something drawable.
 */
export function useSheets(): UseSheetsResult {
  const [requestedId, setRequestedId] = useState<string | null>(null);
  const select = useCallback((id: string) => setRequestedId(id), []);
  return { requestedId, select };
}
