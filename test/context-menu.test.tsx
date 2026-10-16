import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen } from "./render";
import { ContextMenu } from "@/components/diagram/ContextMenu";

describe("ContextMenu", () => {
  it("renders items and runs + closes on select", async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <ContextMenu
        x={10}
        y={10}
        items={[
          { label: "Rotate 90°", onSelect },
          { label: "Delete", onSelect: vi.fn(), danger: true },
        ]}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("menuitem", { name: "Rotate 90°" }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalled();
  });

  it("disables disabled items", () => {
    renderWithProviders(
      <ContextMenu
        x={0}
        y={0}
        items={[
          { label: "Edit definition", onSelect: vi.fn(), disabled: true },
        ]}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("menuitem", { name: "Edit definition" }),
    ).toBeDisabled();
  });
});
