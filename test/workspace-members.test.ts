import { describe, it, expect } from "vitest";
import { adminCount, isLastAdmin } from "@/lib/workspaces/members";
import type { WorkspaceMember } from "@/lib/types";

const m = (
  user_id: string,
  role: WorkspaceMember["role"],
): WorkspaceMember => ({
  workspace_id: "ws-1",
  user_id,
  role,
  created_at: "2026-06-25T00:00:00Z",
});

describe("workspace member helpers", () => {
  it("counts admins", () => {
    expect(
      adminCount([m("a", "admin"), m("b", "editor"), m("c", "admin")]),
    ).toBe(2);
  });

  it("flags the sole admin as the last admin", () => {
    const members = [m("a", "admin"), m("b", "editor")];
    expect(isLastAdmin(members, "a")).toBe(true);
    expect(isLastAdmin(members, "b")).toBe(false);
  });

  it("does not flag an admin when another admin shares the role", () => {
    expect(isLastAdmin([m("a", "admin"), m("b", "admin")], "a")).toBe(false);
  });

  it("returns false for an unknown user", () => {
    expect(isLastAdmin([m("a", "admin")], "ghost")).toBe(false);
  });
});
