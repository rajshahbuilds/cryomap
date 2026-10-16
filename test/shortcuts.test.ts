import { describe, it, expect } from "vitest";
import { resolveShortcut, type ShortcutContext } from "@/lib/diagram/shortcuts";

const EDIT: ShortcutContext = { canEdit: true, inEditableField: false };

const key = (
  k: string,
  mods: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }> = {},
) => ({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, ...mods });

describe("resolveShortcut", () => {
  it("maps the editing keys when checked out", () => {
    expect(resolveShortcut(key("Delete"), EDIT)).toBe("delete");
    expect(resolveShortcut(key("Backspace"), EDIT)).toBe("delete");
    expect(resolveShortcut(key("z", { ctrlKey: true }), EDIT)).toBe("undo");
    expect(
      resolveShortcut(key("z", { ctrlKey: true, shiftKey: true }), EDIT),
    ).toBe("redo");
    expect(resolveShortcut(key("y", { ctrlKey: true }), EDIT)).toBe("redo");
    expect(resolveShortcut(key("s", { ctrlKey: true }), EDIT)).toBe("checkin");
    expect(resolveShortcut(key("d", { ctrlKey: true }), EDIT)).toBe(
      "duplicate",
    );
    expect(resolveShortcut(key("c", { ctrlKey: true }), EDIT)).toBe("copy");
    expect(resolveShortcut(key("v", { ctrlKey: true }), EDIT)).toBe("paste");
  });

  it("maps unmodified R to rotate (only when checked out)", () => {
    expect(resolveShortcut(key("r"), EDIT)).toBe("rotate");
    expect(resolveShortcut(key("R"), EDIT)).toBe("rotate");
    // A modifier or read-only disables it.
    expect(resolveShortcut(key("r", { ctrlKey: true }), EDIT)).toBeNull();
    expect(
      resolveShortcut(key("r"), { canEdit: false, inEditableField: false }),
    ).toBeNull();
  });

  it("maps unmodified M to mirror (only when checked out)", () => {
    expect(resolveShortcut(key("m"), EDIT)).toBe("mirror");
    expect(resolveShortcut(key("m", { metaKey: true }), EDIT)).toBeNull();
    expect(
      resolveShortcut(key("m"), { canEdit: false, inEditableField: false }),
    ).toBeNull();
  });

  it("treats Cmd like Ctrl", () => {
    expect(resolveShortcut(key("d", { metaKey: true }), EDIT)).toBe(
      "duplicate",
    );
  });

  it("always allows Escape (deselect), even read-only", () => {
    expect(resolveShortcut(key("Escape"), EDIT)).toBe("deselect");
    expect(
      resolveShortcut(key("Escape"), {
        canEdit: false,
        inEditableField: false,
      }),
    ).toBe("deselect");
  });

  it("disables editing shortcuts when not checked out", () => {
    const ro = { canEdit: false, inEditableField: false };
    expect(resolveShortcut(key("Delete"), ro)).toBeNull();
    expect(resolveShortcut(key("d", { ctrlKey: true }), ro)).toBeNull();
  });

  it("never fires while typing in a field", () => {
    const typing = { canEdit: true, inEditableField: true };
    expect(resolveShortcut(key("Delete"), typing)).toBeNull();
    expect(resolveShortcut(key("Escape"), typing)).toBeNull();
    expect(resolveShortcut(key("v", { ctrlKey: true }), typing)).toBeNull();
  });

  it("ignores unmapped keys", () => {
    expect(resolveShortcut(key("a", { ctrlKey: true }), EDIT)).toBeNull();
    expect(resolveShortcut(key("x"), EDIT)).toBeNull();
  });
});
