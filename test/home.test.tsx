import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import Home from "@/app/page";
import { render } from "./render";

describe("Home", () => {
  it("introduces CryoMap and links to the primary actions", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: /a shared map of your cryogenic wiring/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create your workspace" }),
    ).toHaveAttribute("href", "/auth/login?next=%2Fworkspaces%2Fnew");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/auth/login",
    );
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
