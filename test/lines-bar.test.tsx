import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen } from "./render";
import { LinesBar } from "@/components/diagram/LinesBar";
import { makeLine } from "./fixtures";

function setup(overrides: Partial<Parameters<typeof LinesBar>[0]> = {}) {
  const props = {
    lines: [
      makeLine({ id: "a", name: "XY 1", sort_order: 0 }),
      makeLine({ id: "b", name: "Flux 1", sort_order: 1 }),
    ],
    onAdd: vi.fn(),
    onRename: vi.fn(),
    onSetType: vi.fn(),
    onToggleLabel: vi.fn(),
    onMove: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  return { props, ...renderWithProviders(<LinesBar {...props} />) };
}

describe("LinesBar", () => {
  it("adds a line", async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole("button", { name: /add line/i }));
    expect(props.onAdd).toHaveBeenCalledOnce();
  });

  it("renames a line on blur", async () => {
    const { props, user } = setup();
    const input = screen.getAllByLabelText("Line name")[0];
    await user.clear(input);
    await user.type(input, "Drive A");
    await user.tab();
    expect(props.onRename).toHaveBeenCalledWith("a", "Drive A");
  });

  it("disables move-left for the first line and move-right for the last", () => {
    setup();
    const left = screen.getAllByRole("button", { name: /move line left/i });
    const right = screen.getAllByRole("button", { name: /move line right/i });
    expect(left[0]).toBeDisabled();
    expect(right[1]).toBeDisabled();
  });

  it("deletes a line", async () => {
    const { props, user } = setup();
    await user.click(
      screen.getAllByRole("button", { name: /delete line/i })[1],
    );
    expect(props.onDelete).toHaveBeenCalledWith("b");
  });
});
