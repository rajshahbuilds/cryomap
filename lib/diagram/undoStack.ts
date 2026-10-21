import type { Db } from "@/lib/repositories";
import type { DiagramState } from "@/lib/types";

export type DiagramStateUpdate = (state: DiagramState) => DiagramState;

/**
 * A reversible edit. `redo` performs (or replays) the operation; `undo` reverses
 * it. Both run against a Supabase client. Commands may hold mutable state (e.g.
 * the id of a re-created row) so redo-after-undo stays consistent.
 */
export interface UndoCommand {
  redo: (db: Db) => Promise<void>;
  undo: (db: Db) => Promise<void>;
  /** Apply the forward operation to the browser copy before the DB responds. */
  optimisticRedo?: DiagramStateUpdate;
  /** Apply the inverse operation to the browser copy before the DB responds. */
  optimisticUndo?: DiagramStateUpdate;
}

/** Past (undoable) and future (redoable) command stacks. */
export interface UndoStack<C = UndoCommand> {
  past: C[];
  future: C[];
}

export function emptyStack<C = UndoCommand>(): UndoStack<C> {
  return { past: [], future: [] };
}

/** Record a new edit. Always clears the redo stack (linear history). */
export function pushCommand<C>(stack: UndoStack<C>, command: C): UndoStack<C> {
  return { past: [...stack.past, command], future: [] };
}

export function canUndo<C>(stack: UndoStack<C>): boolean {
  return stack.past.length > 0;
}

export function canRedo<C>(stack: UndoStack<C>): boolean {
  return stack.future.length > 0;
}

/** Dirty since checkout = any recorded edit in the past stack. */
export function isDirty<C>(stack: UndoStack<C>): boolean {
  return stack.past.length > 0;
}

/** Pop the most recent command for undoing; moves it onto the redo stack. */
export function popUndo<C>(
  stack: UndoStack<C>,
): { command: C; next: UndoStack<C> } | null {
  if (stack.past.length === 0) return null;
  const command = stack.past[stack.past.length - 1];
  return {
    command,
    next: { past: stack.past.slice(0, -1), future: [command, ...stack.future] },
  };
}

/** Pop the next command for redoing; moves it back onto the past stack. */
export function popRedo<C>(
  stack: UndoStack<C>,
): { command: C; next: UndoStack<C> } | null {
  if (stack.future.length === 0) return null;
  const command = stack.future[0];
  return {
    command,
    next: { past: [...stack.past, command], future: stack.future.slice(1) },
  };
}
