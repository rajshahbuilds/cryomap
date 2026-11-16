"use client";

import { useSyncExternalStore } from "react";

/** Assume online when the environment doesn't expose browser connectivity. */
function readOnline(): boolean {
  return typeof navigator === "undefined" ? true : (navigator.onLine ?? true);
}

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

// React uses this same value for SSR and the first hydration render, then
// reads the real browser state. Node's navigator may exist without onLine.
const serverSnapshot = () => true;

/** Track connectivity to prevent mutating actions while the browser is offline. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, readOnline, serverSnapshot);
}
