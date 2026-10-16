import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen } from "./render";
import { LockBanner } from "@/components/diagram/LockBanner";

describe("LockBanner", () => {
  it("names the holder, shows the since-time, and force-releases", async () => {
    const onForceRelease = vi.fn();
    const { user } = renderWithProviders(
      <LockBanner
        holderName="Ada Lovelace"
        holderAvatarUrl="https://img.example/ada.png"
        since="2:14 PM"
        onForceRelease={onForceRelease}
      />,
    );

    expect(screen.getByText(/Ada Lovelace/)).toBeInTheDocument();
    expect(screen.getByText(/since 2:14 PM/)).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /ada lovelace/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /force release/i }));
    expect(onForceRelease).toHaveBeenCalledOnce();
  });

  it("falls back to 'another user' without a name", () => {
    renderWithProviders(
      <LockBanner
        holderName={null}
        holderAvatarUrl={null}
        since={null}
        onForceRelease={vi.fn()}
      />,
    );
    expect(screen.getByText(/another user/)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
