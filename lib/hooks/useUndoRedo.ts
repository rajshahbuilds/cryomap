"use client";

import { useCallback, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  canRedo,
  canUndo,
  emptyStack,
  isDirty,
  popRedo,
  popUndo,
  pushCommand,
  type UndoCommand,
  type UndoStack,
} from "@/lib/diagram/undoStack";

export interface UseUndoRedo {
  /** Perform an edit: run its `redo`, record it, then run `onApplied`. */
  apply: (command: UndoCommand) => void;
  undo: () => void;
  redo: () => void;
  /** Clear history (e.g. on checkout / release). */
  reset: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
}

/**
 * Local undo/redo over reversible edit commands. `apply` runs the forward op and
 * records its inverse; `undo`/`redo` walk the stack, re-running against a fresh
 * Supabase client. `onApplied` (a diagram reload) runs after each change so the
 * view re-syncs to DB truth even when an op fails. `onError`, if given, receives
 * any error thrown by a command (e.g. a Supabase write failure) so callers can
 * surface it as a toast instead of failing silently.
 */
export function useUndoRedo(
  onApplied: () => void,
  onError?: (error: unknown) => void,
): UseUndoRedo {
  const [stack, setStack] = useState<UndoStack>(emptyStack());

  const apply = useCallback(
    (command: UndoCommand) => {
      void (async () => {
        try {
          await command.redo(createSupabaseBrowserClient());
          setStack((s) => pushCommand(s, command));
        } catch (error) {
          onError?.(error);
        } finally {
          onApplied();
        }
      })();
    },
    [onApplied, onError],
  );

  const undo = useCallback(() => {
    setStack((current) => {
      const popped = popUndo(current);
      if (!popped) return current;
      void (async () => {
        try {
          await popped.command.undo(createSupabaseBrowserClient());
        } catch (error) {
          onError?.(error);
        } finally {
          onApplied();
        }
      })();
      return popped.next;
    });
  }, [onApplied, onError]);

  const redo = useCallback(() => {
    setStack((current) => {
      const popped = popRedo(current);
      if (!popped) return current;
      void (async () => {
        try {
          await popped.command.redo(createSupabaseBrowserClient());
        } catch (error) {
          onError?.(error);
        } finally {
          onApplied();
        }
      })();
      return popped.next;
    });
  }, [onApplied, onError]);

  const reset = useCallback(() => setStack(emptyStack()), []);

  return {
    apply,
    undo,
    redo,
    reset,
    canUndo: canUndo(stack),
    canRedo: canRedo(stack),
    isDirty: isDirty(stack),
  };
}
