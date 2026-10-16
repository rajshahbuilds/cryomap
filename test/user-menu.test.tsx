import { describe, it, expect } from "vitest";
import { renderWithProviders, screen } from "./render";
import { UserMenu } from "@/components/auth/UserMenu";

describe("UserMenu", () => {
  it("shows the avatar, name, email, and a sign-out control", () => {
    renderWithProviders(
      <UserMenu
        profile={{
          displayName: "Ada Lovelace",
          email: "ada@example.com",
          avatarUrl: "https://img.example/ada.png",
        }}
      />,
    );

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /ada lovelace/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign out/i }),
    ).toBeInTheDocument();
  });

  it("renders initials when there is no avatar", () => {
    renderWithProviders(
      <UserMenu
        profile={{
          displayName: "Ada Lovelace",
          email: "ada@example.com",
          avatarUrl: null,
        }}
      />,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("falls back to the email when there is no display name", () => {
    renderWithProviders(
      <UserMenu
        profile={{
          displayName: null,
          email: "ada@example.com",
          avatarUrl: null,
        }}
      />,
    );

    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
  });
});
