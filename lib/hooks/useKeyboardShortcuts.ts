"use client";

import { useEffect, useRef } from "react";
import {
  isEditableElement,
  resolveShortcut,
  type ShortcutAction,
} from "@/lib/diagram/shortcuts";

export type ShortcutHandlers = Partial<Record<ShortcutAction, () => void>>;

/**
 * Bind the editor keymap to `keydown`. A matched action's browser default is
 * suppressed (so Ctrl+S / Ctrl+D don't trigger the browser) and its handler is
 * invoked if provided — unwired actions (undo/redo/checkin) become no-ops until
 * their tickets land.
 */
export function useKeyboardShortcuts(
  handlers: ShortcutHandlers,
  canEdit: boolean,
): void {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = resolveShortcut(event, {
        canEdit,
        inEditableField: isEditableElement(event.target),
      });
      if (!action) return;
      event.preventDefault();
      handlersRef.current[action]?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canEdit]);
}
