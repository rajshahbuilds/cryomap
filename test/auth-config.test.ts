import { describe, it, expect } from "vitest";
import {
  DEFAULT_AUTHED_REDIRECT,
  isPublicPath,
  LOGIN_PATH,
  safeRedirectPath,
} from "@/lib/auth/config";

it("uses the public homepage as the sign-in destination", () => {
  expect(LOGIN_PATH).toBe("/");
});

describe("isPublicPath", () => {
  it("treats the landing page and auth routes as public", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/playground")).toBe(true);
    expect(isPublicPath("/auth")).toBe(true);
    expect(isPublicPath("/auth/login")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
  });

  it("treats app routes as protected", () => {
    expect(isPublicPath("/fridges")).toBe(false);
    expect(isPublicPath("/fridges/abc-123")).toBe(false);
    expect(isPublicPath("/authxyz")).toBe(false);
  });
});

describe("safeRedirectPath", () => {
  it("returns same-origin relative paths unchanged", () => {
    expect(safeRedirectPath("/fridges")).toBe("/fridges");
    expect(safeRedirectPath("/fridges/abc?q=1")).toBe("/fridges/abc?q=1");
  });

  it("falls back when the target is missing", () => {
    expect(safeRedirectPath(null)).toBe(DEFAULT_AUTHED_REDIRECT);
    expect(safeRedirectPath(undefined)).toBe(DEFAULT_AUTHED_REDIRECT);
    expect(safeRedirectPath("")).toBe(DEFAULT_AUTHED_REDIRECT);
  });

  it("rejects open-redirect payloads", () => {
    expect(safeRedirectPath("//evil.com")).toBe(DEFAULT_AUTHED_REDIRECT);
    expect(safeRedirectPath("https://evil.com")).toBe(DEFAULT_AUTHED_REDIRECT);
    expect(safeRedirectPath("javascript:alert(1)")).toBe(
      DEFAULT_AUTHED_REDIRECT,
    );
  });

  it("honors a custom fallback", () => {
    expect(safeRedirectPath(null, "/")).toBe("/");
  });
});
