import { describe, it, expect } from "vitest";
import { resolveActiveWorkspace } from "@/lib/workspaces/active";
import type { Workspace } from "@/lib/types";

const ws = (id: string): Workspace => ({
  id,
  name: id,
  created_by: null,
  created_at: "2026-06-25T00:00:00Z",
  updated_at: "2026-06-25T00:00:00Z",
});

describe("resolveActiveWorkspace", () => {
  it("returns null when the user has no workspaces", () => {
    expect(resolveActiveWorkspace([], "anything")).toBeNull();
  });

  it("returns the cookie's workspace when the user still belongs to it", () => {
    expect(resolveActiveWorkspace([ws("a"), ws("b")], "b")?.id).toBe("b");
  });

  it("falls back to the first workspace when the cookie is missing or stale", () => {
    const list = [ws("a"), ws("b")];
    expect(resolveActiveWorkspace(list, undefined)?.id).toBe("a");
    expect(resolveActiveWorkspace(list, "gone")?.id).toBe("a");
  });
});
