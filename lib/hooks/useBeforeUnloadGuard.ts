"use client";

import { useEffect } from "react";

/**
 * Warn (native browser prompt) before unloading the page while `enabled` — e.g.
 * the fridge is checked out with unsaved/dirty edits.
 */
export function useBeforeUnloadGuard(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [enabled]);
}
