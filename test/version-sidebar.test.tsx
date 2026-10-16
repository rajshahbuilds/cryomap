import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen } from "./render";
import { VersionSidebar } from "@/components/diagram/VersionSidebar";
import type { Version } from "@/lib/types";

const version = (overrides: Partial<Version> = {}): Version =>
  ({
    id: "v1",
    fridge_id: "f1",
    snapshot: {} as never,
    commit_message: "Initial wiring",
    tag: "v1",
    snapshot_type: "current",
    author_id: "u1",
    author_name: "Ada Lovelace",
    created_at: "2026-06-22T12:00:00.000Z",
    ...overrides,
  }) as Version;

describe("VersionSidebar", () => {
  it("renders version metadata, badges, and a preview link", () => {
    renderWithProviders(
      <VersionSidebar fridgeId="f1" versions={[version()]} />,
    );
    expect(screen.getByText("Initial wiring")).toBeInTheDocument();
    expect(screen.getByText(/Ada Lovelace/)).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("current")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /preview/i })).toHaveAttribute(
      "href",
      "/fridges/f1/versions/v1",
    );
  });

  it("shows Restore only when allowed, and calls back", async () => {
    const onRestore = vi.fn();
    const { user } = renderWithProviders(
      <VersionSidebar
        fridgeId="f1"
        versions={[version()]}
        canRestore
        onRestore={onRestore}
      />,
    );
    await user.click(screen.getByRole("button", { name: /restore/i }));
    expect(onRestore).toHaveBeenCalledOnce();
  });

  it("hides Restore without canRestore", () => {
    renderWithProviders(
      <VersionSidebar
        fridgeId="f1"
        versions={[version()]}
        onRestore={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /restore/i }),
    ).not.toBeInTheDocument();
  });

  it("shows an empty state", () => {
    renderWithProviders(<VersionSidebar fridgeId="f1" versions={[]} />);
    expect(screen.getByText(/no versions yet/i)).toBeInTheDocument();
  });
});
