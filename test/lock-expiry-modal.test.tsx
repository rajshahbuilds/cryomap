import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen } from "./render";
import { LockExpiryModal } from "@/components/diagram/LockExpiryModal";

describe("LockExpiryModal", () => {
  it("offers re-checkout, export, and read-only when the lock is free", async () => {
    const onReacquire = vi.fn();
    const onExport = vi.fn();
    const onDismiss = vi.fn();
    const { user } = renderWithProviders(
      <LockExpiryModal
        recovery="reacquire"
        onReacquire={onReacquire}
        onExport={onExport}
        onDismiss={onDismiss}
      />,
    );

    await user.click(screen.getByRole("button", { name: /re-check out/i }));
    await user.click(screen.getByRole("button", { name: /export as json/i }));
    await user.click(
      screen.getByRole("button", { name: /continue read-only/i }),
    );
    expect(onReacquire).toHaveBeenCalledOnce();
    expect(onExport).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("hides re-checkout when another user took the lock", () => {
    renderWithProviders(
      <LockExpiryModal
        recovery="taken"
        onReacquire={vi.fn()}
        onExport={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /re-check out/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /export as json/i }),
    ).toBeInTheDocument();
  });
});
