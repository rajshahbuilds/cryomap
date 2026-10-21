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
  type DiagramStateUpdate,
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
 * Supabase client. Commands with optimistic state updates change the canvas
 * immediately and skip the routine full reload. Commands without one reconcile
 * after the DB operation. Failures always reconcile to DB truth. `onError`, if
 * given, receives command failures so callers can surface them as a toast.
 */
export function useUndoRedo(
  onApplied: () => void,
  onError?: (error: unknown) => void,
  onStateUpdate?: (update: DiagramStateUpdate) => void,
): UseUndoRedo {
  const [stack, setStack] = useState<UndoStack>(emptyStack());

  const applyOptimistic = useCallback(
    (update: DiagramStateUpdate | undefined) => {
      if (!update || !onStateUpdate) return false;
      onStateUpdate(update);
      return true;
    },
    [onStateUpdate],
  );

  const apply = useCallback(
    (command: UndoCommand) => {
      const optimistic = applyOptimistic(command.optimisticRedo);
      void (async () => {
        try {
          await command.redo(createSupabaseBrowserClient());
          setStack((s) => pushCommand(s, command));
        } catch (error) {
          applyOptimistic(command.optimisticUndo);
          onError?.(error);
          onApplied();
          return;
        }
        if (!optimistic) onApplied();
      })();
    },
    [applyOptimistic, onApplied, onError],
  );

  const undo = useCallback(() => {
    const popped = popUndo(stack);
    if (!popped) return;
    setStack(popped.next);
    const optimistic = applyOptimistic(popped.command.optimisticUndo);
    void (async () => {
      try {
        await popped.command.undo(createSupabaseBrowserClient());
      } catch (error) {
        applyOptimistic(popped.command.optimisticRedo);
        onError?.(error);
        onApplied();
        return;
      }
      if (!optimistic) onApplied();
    })();
  }, [applyOptimistic, onApplied, onError, stack]);

  const redo = useCallback(() => {
    const popped = popRedo(stack);
    if (!popped) return;
    setStack(popped.next);
    const optimistic = applyOptimistic(popped.command.optimisticRedo);
    void (async () => {
      try {
        await popped.command.redo(createSupabaseBrowserClient());
      } catch (error) {
        applyOptimistic(popped.command.optimisticUndo);
        onError?.(error);
        onApplied();
        return;
      }
      if (!optimistic) onApplied();
    })();
  }, [applyOptimistic, onApplied, onError, stack]);

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
