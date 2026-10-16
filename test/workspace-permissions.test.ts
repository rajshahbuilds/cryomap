import { describe, it, expect } from "vitest";
import {
  canEdit,
  canManageMembers,
  hasAtLeast,
  isAdmin,
  isViewer,
} from "@/lib/workspaces/permissions";

describe("workspace permissions", () => {
  it("ranks viewer < editor < admin", () => {
    expect(hasAtLeast("admin", "editor")).toBe(true);
    expect(hasAtLeast("editor", "editor")).toBe(true);
    expect(hasAtLeast("viewer", "editor")).toBe(false);
    expect(hasAtLeast("editor", "admin")).toBe(false);
  });

  it("canEdit is true for editor and admin, false for viewer", () => {
    expect(canEdit("admin")).toBe(true);
    expect(canEdit("editor")).toBe(true);
    expect(canEdit("viewer")).toBe(false);
  });

  it("canManageMembers / isAdmin are admin-only", () => {
    expect(canManageMembers("admin")).toBe(true);
    expect(canManageMembers("editor")).toBe(false);
    expect(canManageMembers("viewer")).toBe(false);
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("editor")).toBe(false);
  });

  it("isViewer is viewer-only", () => {
    expect(isViewer("viewer")).toBe(true);
    expect(isViewer("editor")).toBe(false);
    expect(isViewer("admin")).toBe(false);
  });
});
