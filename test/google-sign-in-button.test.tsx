import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen } from "./render";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

describe("GoogleSignInButton", () => {
  it("renders the default label and fires onClick", async () => {
    const onClick = vi.fn();
    const { user } = renderWithProviders(
      <GoogleSignInButton onClick={onClick} />,
    );

    await user.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("uses a shorter label in the compact header variant", () => {
    renderWithProviders(<GoogleSignInButton compact />);

    expect(
      screen.getByRole("button", { name: /sign in with google/i }),
    ).toBeInTheDocument();
  });

  it("shows a loading state and is disabled while signing in", () => {
    renderWithProviders(<GoogleSignInButton loading />);

    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
  });
});
