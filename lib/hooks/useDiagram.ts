"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DiagramState, Fridge } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fridgesRepo } from "@/lib/repositories";
import { assembleDiagram, type DiagramView } from "@/lib/diagram/assemble";
import { loadDiagramState } from "@/lib/diagram/load";
import type { DiagramStateUpdate } from "@/lib/diagram/undoStack";

export interface UseDiagramResult {
  status: "loading" | "ready" | "error";
  /** The rendered sheet's view. */
  view: DiagramView | null;
  /**
   * The whole fridge's raw rows — every sheet. `view` is scoped to one sheet, so
   * anything that must reason across sheets (deleting a background tab and being
   * able to undo it; snapshotting) needs this instead.
   */
  state: DiagramState | null;
  fridge: Fridge | null;
  error: string | null;
  /** Re-fetch the diagram (e.g. after an edit). */
  reload: () => void;
  /** Apply an immediate browser-side edit without waiting for a refetch. */
  updateState: (update: DiagramStateUpdate) => void;
}

/**
 * Load a fridge's live diagram (read path) and normalize it for rendering.
 * Surfaces loading / ready / error explicitly — load failures never fail
 * silently.
 *
 * The fetch pulls the *whole fridge*; `sheetId` only narrows the assembled
 * view, so switching tabs is a re-render rather than a round-trip. An id that
 * matches no sheet falls back to the fridge sheet.
 */
export function useDiagram(
  fridgeId: string,
  sheetId?: string | null,
): UseDiagramResult {
  const [result, setResult] = useState<{
    status: UseDiagramResult["status"];
    state: DiagramState | null;
    fridge: Fridge | null;
    error: string | null;
  }>({ status: "loading", state: null, fridge: null, error: null });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const updateState = useCallback((update: DiagramStateUpdate) => {
    setResult((current) =>
      current.state
        ? { ...current, state: update(current.state), error: null }
        : current,
    );
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      // Keep an already-rendered fridge mounted during background
      // reconciliation. Only the initial load (or a different fridge) needs a
      // blocking loading state.
      if (active)
        setResult((current) =>
          current.state && current.fridge?.id === fridgeId
            ? { ...current, error: null }
            : {
                status: "loading",
                state: null,
                fridge: null,
                error: null,
              },
        );
      try {
        const db = createSupabaseBrowserClient();
        const [state, fridge] = await Promise.all([
          loadDiagramState(db, fridgeId),
          fridgesRepo(db).get(fridgeId),
        ]);
        if (!active) return;
        setResult({ status: "ready", state, fridge, error: null });
      } catch (error) {
        if (!active) return;
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load the diagram.";
        setResult((current) =>
          current.state && current.fridge?.id === fridgeId
            ? { ...current, status: "ready", error: message }
            : {
                status: "error",
                state: null,
                fridge: null,
                error: message,
              },
        );
      }
    })();

    return () => {
      active = false;
    };
  }, [fridgeId, nonce]);

  const view = useMemo(
    () => (result.state ? assembleDiagram(result.state, sheetId) : null),
    [result.state, sheetId],
  );

  return {
    status: result.status,
    view,
    state: result.state,
    fridge: result.fridge,
    error: result.error,
    reload,
    updateState,
  };
}
