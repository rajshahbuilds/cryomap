import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import Home from "@/app/page";
import { render, userEvent } from "./render";

const { signInWithGoogleMock } = vi.hoisted(() => ({
  signInWithGoogleMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth/client", () => ({
  signInWithGoogle: signInWithGoogleMock,
}));

describe("Home", () => {
  it("introduces CryoMap and starts Google sign-in directly", async () => {
    const user = userEvent.setup();
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: /a shared map of your cryogenic wiring/i,
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(signInWithGoogleMock).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("link", { name: "Create your workspace" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Explore the code" }),
    ).not.toBeInTheDocument();
  });

  it("links the footer policies to the public repository", () => {
    render(<Home />);

    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      "https://github.com/rajshahbuilds/cryomap/blob/main/PRIVACY.md",
    );
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute(
      "href",
      "https://github.com/rajshahbuilds/cryomap/blob/main/TERMS.md",
    );
  });
});
