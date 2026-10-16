import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen } from "./render";
import { LineModal } from "@/components/diagram/LineModal";

describe("LineModal", () => {
  it("requires a name before creating", async () => {
    const onConfirm = vi.fn();
    const { user } = renderWithProviders(
      <LineModal
        defaultName="Line 3"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );
    await user.clear(screen.getByLabelText("Name"));
    await user.click(screen.getByRole("button", { name: /create line/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("confirms with the entered name, type, and direction", async () => {
    const onConfirm = vi.fn();
    const { user } = renderWithProviders(
      <LineModal
        defaultName="Line 3"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );
    await user.selectOptions(screen.getByLabelText("Type"), "microwave_input");
    await user.selectOptions(screen.getByLabelText("Direction"), "input");
    await user.click(screen.getByRole("button", { name: /create line/i }));
    expect(onConfirm).toHaveBeenCalledWith({
      name: "Line 3",
      lineType: "microwave_input",
      direction: "input",
    });
  });

  it("sends null type and direction when left unset", async () => {
    const onConfirm = vi.fn();
    const { user } = renderWithProviders(
      <LineModal
        defaultName="Line 3"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /create line/i }));
    expect(onConfirm).toHaveBeenCalledWith({
      name: "Line 3",
      lineType: null,
      direction: null,
    });
  });
});
