import { describe, it, expect } from "vitest";
import {
  generateInviteToken,
  invitePath,
  inviteStatusMessage,
  isJoinSuccess,
  parseInviteToken,
} from "@/lib/workspaces/invites";

describe("invite helpers", () => {
  it("builds the join path", () => {
    expect(invitePath("abc123")).toBe("/join/abc123");
  });

  it("generates a 36-char hex token, unique per call", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a).toMatch(/^[0-9a-f]{36}$/);
    expect(a).not.toBe(b);
  });

  it("treats joined and already_member as success", () => {
    expect(isJoinSuccess("joined")).toBe(true);
    expect(isJoinSuccess("already_member")).toBe(true);
    expect(isJoinSuccess("expired")).toBe(false);
    expect(isJoinSuccess("invalid")).toBe(false);
  });

  it("maps failure statuses to clear messages", () => {
    expect(inviteStatusMessage("invalid")).toMatch(/valid/i);
    expect(inviteStatusMessage("revoked")).toMatch(/revoked/i);
    expect(inviteStatusMessage("expired")).toMatch(/expired/i);
    expect(inviteStatusMessage("unauthenticated")).toMatch(/sign in/i);
  });

  it("parses a token from a URL, path, or bare token", () => {
    expect(parseInviteToken("https://cryomap.vercel.app/join/abc123")).toBe(
      "abc123",
    );
    expect(parseInviteToken("/join/abc123")).toBe("abc123");
    expect(parseInviteToken("https://x/join/abc123?ref=1")).toBe("abc123");
    expect(parseInviteToken("  abc123  ")).toBe("abc123");
  });

  it("returns null when no token can be found", () => {
    expect(parseInviteToken("")).toBeNull();
    expect(parseInviteToken("   ")).toBeNull();
    expect(parseInviteToken("https://example.com/other")).toBeNull();
  });
});
