import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen } from "./render";
import { CheckInModal } from "@/components/diagram/CheckInModal";

describe("CheckInModal", () => {
  it("requires a message before confirming", async () => {
    const onConfirm = vi.fn();
    const { user } = renderWithProviders(
      <CheckInModal onConfirm={onConfirm} onClose={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: /check in/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("confirms with message, tag, and snapshot type", async () => {
    const onConfirm = vi.fn();
    const { user } = renderWithProviders(
      <CheckInModal onConfirm={onConfirm} onClose={vi.fn()} />,
    );
    await user.type(screen.getByPlaceholderText(/what changed/i), "Added amp");
    await user.type(screen.getByPlaceholderText(/v1\.2/i), "rev-3");
    await user.selectOptions(screen.getByRole("combobox"), "planned");
    await user.click(screen.getByRole("button", { name: /check in/i }));

    expect(onConfirm).toHaveBeenCalledWith({
      message: "Added amp",
      tag: "rev-3",
      snapshotType: "planned",
    });
  });
});
