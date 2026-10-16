"use client";

import { useEffect, useState } from "react";

/** SSR-safe initial read; assume online when the API is unavailable. */
function readOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

/**
 * Track the browser's connectivity via the `online`/`offline` events. Used to
 * disable mutating actions (check-in/check-out) while offline so writes don't
 * fail silently against an unreachable Supabase.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(readOnline);

  useEffect(() => {
    const sync = () => setOnline(readOnline());
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return online;
}
