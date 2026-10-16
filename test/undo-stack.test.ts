import { describe, it, expect } from "vitest";
import {
  canRedo,
  canUndo,
  emptyStack,
  isDirty,
  popRedo,
  popUndo,
  pushCommand,
} from "@/lib/diagram/undoStack";

describe("undoStack", () => {
  it("starts empty and clean", () => {
    const s = emptyStack<string>();
    expect(canUndo(s)).toBe(false);
    expect(canRedo(s)).toBe(false);
    expect(isDirty(s)).toBe(false);
    expect(popUndo(s)).toBeNull();
    expect(popRedo(s)).toBeNull();
  });

  it("becomes dirty + undoable after a push", () => {
    const s = pushCommand(emptyStack<string>(), "a");
    expect(s.past).toEqual(["a"]);
    expect(isDirty(s)).toBe(true);
    expect(canUndo(s)).toBe(true);
  });

  it("moves commands between past and future on undo/redo", () => {
    const s = pushCommand(pushCommand(emptyStack<string>(), "a"), "b");

    const u1 = popUndo(s)!;
    expect(u1.command).toBe("b");
    expect(u1.next).toEqual({ past: ["a"], future: ["b"] });

    const u2 = popUndo(u1.next)!;
    expect(u2.command).toBe("a");
    expect(u2.next).toEqual({ past: [], future: ["a", "b"] });

    const r = popRedo(u2.next)!;
    expect(r.command).toBe("a");
    expect(r.next).toEqual({ past: ["a"], future: ["b"] });
  });

  it("clears the redo stack when a new edit is recorded", () => {
    const undone = popUndo(pushCommand(emptyStack<string>(), "a"))!;
    expect(canRedo(undone.next)).toBe(true);

    const branched = pushCommand(undone.next, "b");
    expect(branched.future).toEqual([]);
    expect(branched.past).toEqual(["b"]);
  });
});
