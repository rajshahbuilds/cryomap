import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen } from "./render";
import { StageModal } from "@/components/diagram/StageModal";

describe("StageModal", () => {
  it("requires a name before creating", async () => {
    const onConfirm = vi.fn();
    const { user } = renderWithProviders(
      <StageModal
        defaultName="Stage 3"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );
    await user.clear(screen.getByLabelText("Name"));
    await user.click(screen.getByRole("button", { name: /create stage/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("confirms with the entered name, temperature, and color", async () => {
    const onConfirm = vi.fn();
    const { user } = renderWithProviders(
      <StageModal
        defaultName="Stage 3"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText("Temperature"), "4 K");
    await user.click(screen.getByRole("button", { name: /create stage/i }));
    expect(onConfirm).toHaveBeenCalledWith({
      name: "Stage 3",
      nominalTemp: "4 K",
      color: expect.any(String),
    });
  });

  it("sends a null temperature when left blank", async () => {
    const onConfirm = vi.fn();
    const { user } = renderWithProviders(
      <StageModal
        defaultName="Stage 3"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /create stage/i }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ nominalTemp: null }),
    );
  });
});
