"use client";

import { useEffect, useMemo, useRef } from "react";

/**
 * Returns a debounced version of `fn`: calls coalesce, and only the last one
 * fires after `delay` ms of quiet. The latest `fn` closure is always used, and
 * the pending call is cancelled on unmount.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number,
): (...args: Args) => void {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return useMemo(
    () =>
      (...args: Args) => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => fnRef.current(...args), delay);
      },
    [delay],
  );
}
