import { describe, it, expect } from "vitest";
import { RepositoryError } from "@/lib/repositories";
import { errorToMessage } from "@/lib/toast/errorMessage";

describe("errorToMessage", () => {
  it("surfaces a RepositoryError's message", () => {
    expect(errorToMessage(new RepositoryError("duplicate key value"))).toBe(
      "duplicate key value",
    );
  });

  it("surfaces a plain Error's message", () => {
    expect(errorToMessage(new Error("boom"))).toBe("boom");
  });

  it("prefixes with context when given", () => {
    expect(
      errorToMessage(new Error("row not found"), "Couldn't check out"),
    ).toBe("Couldn't check out: row not found");
  });

  it("falls back to the bare context when the error has no detail", () => {
    expect(errorToMessage({}, "Couldn't save")).toBe("Couldn't save");
    expect(errorToMessage(new Error(""), "Couldn't save")).toBe(
      "Couldn't save",
    );
  });

  it("humanizes network failures", () => {
    expect(errorToMessage(new Error("Failed to fetch"))).toBe(
      "Network request failed — check your connection.",
    );
    expect(errorToMessage(new RepositoryError("TypeError: Load failed"))).toBe(
      "Network request failed — check your connection.",
    );
  });

  it("accepts a raw string", () => {
    expect(errorToMessage("plain message")).toBe("plain message");
  });
});
