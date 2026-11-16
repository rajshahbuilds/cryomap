"use client";

import { useCallback, useRef, useState } from "react";
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
  pending: boolean;
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
  const stackRef = useRef(stack);
  const queue = useRef(Promise.resolve());
  const generation = useRef(0);
  const pendingCount = useRef(0);
  const [pending, setPending] = useState(false);

  const applyOptimistic = useCallback(
    (update: DiagramStateUpdate | undefined) => {
      if (!update || !onStateUpdate) return false;
      onStateUpdate(update);
      return true;
    },
    [onStateUpdate],
  );
  const enqueue = useCallback(
    (operation: (currentGeneration: number) => Promise<void>) => {
      const currentGeneration = generation.current;
      pendingCount.current++;
      setPending(true);
      queue.current = queue.current
        .then(async () => {
          if (generation.current === currentGeneration)
            await operation(currentGeneration);
        })
        .catch((error) => {
          onError?.(error);
          onApplied();
        })
        .finally(() => {
          pendingCount.current--;
          setPending(pendingCount.current > 0);
        });
    },
    [onApplied, onError],
  );
  const record = useCallback((next: UndoStack) => {
    stackRef.current = next;
    setStack(next);
  }, []);

  const apply = useCallback(
    (command: UndoCommand) =>
      enqueue(async (currentGeneration) => {
        const optimistic = applyOptimistic(command.optimisticRedo);
        try {
          await command.redo(createSupabaseBrowserClient());
        } catch (error) {
          applyOptimistic(command.optimisticUndo);
          throw error;
        }
        if (generation.current === currentGeneration)
          record(pushCommand(stackRef.current, command));
        if (!optimistic || command.reconcileAfter) onApplied();
      }),
    [enqueue, applyOptimistic, onApplied, record],
  );

  const navigate = useCallback(
    (direction: "undo" | "redo") =>
      enqueue(async (currentGeneration) => {
        const popped =
          direction === "undo"
            ? popUndo(stackRef.current)
            : popRedo(stackRef.current);
        if (!popped) return;
        const command = popped.command;
        const optimistic = applyOptimistic(
          direction === "undo"
            ? command.optimisticUndo
            : command.optimisticRedo,
        );
        try {
          await command[direction](createSupabaseBrowserClient());
        } catch (error) {
          applyOptimistic(
            direction === "undo"
              ? command.optimisticRedo
              : command.optimisticUndo,
          );
          throw error;
        }
        if (generation.current === currentGeneration) record(popped.next);
        if (!optimistic || command.reconcileAfter) onApplied();
      }),
    [enqueue, applyOptimistic, onApplied, record],
  );
  const undo = useCallback(() => navigate("undo"), [navigate]);
  const redo = useCallback(() => navigate("redo"), [navigate]);
  const reset = useCallback(() => {
    generation.current++;
    record(emptyStack());
  }, [record]);
  return {
    apply,
    undo,
    redo,
    reset,
    canUndo: !pending && canUndo(stack),
    canRedo: !pending && canRedo(stack),
    isDirty: isDirty(stack) || pending,
    pending,
  };
}
