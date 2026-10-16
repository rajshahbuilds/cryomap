export type ShortcutAction =
  | "delete"
  | "deselect"
  | "rotate"
  | "mirror"
  | "undo"
  | "redo"
  | "checkin"
  | "duplicate"
  | "copy"
  | "paste";

export interface ShortcutContext {
  /** The current user holds the lock (editing allowed). */
  canEdit: boolean;
  /** Focus is in a text field — shortcuts must not hijack typing. */
  inEditableField: boolean;
}

interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

/** True when the event target is a text input / textarea / select / editable. */
export function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * Map a keydown to an editor action — the single keymap. Never fires while
 * typing in a field; `Escape` (deselect) always works; every other action
 * requires checkout. Pan (Space+drag) and zoom (scroll) are handled by the
 * canvas, not here.
 */
export function resolveShortcut(
  event: KeyLike,
  { canEdit, inEditableField }: ShortcutContext,
): ShortcutAction | null {
  if (inEditableField) return null;

  if (event.key === "Escape") return "deselect";

  if (!canEdit) return null;

  const mod = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();

  if (key === "delete" || key === "backspace") return "delete";
  if (key === "r" && !mod) return "rotate";
  if (key === "m" && !mod) return "mirror";
  if (!mod) return null;

  switch (key) {
    case "z":
      return event.shiftKey ? "redo" : "undo";
    case "y":
      return "redo";
    case "s":
      return "checkin";
    case "d":
      return "duplicate";
    case "c":
      return "copy";
    case "v":
      return "paste";
    default:
      return null;
  }
}
