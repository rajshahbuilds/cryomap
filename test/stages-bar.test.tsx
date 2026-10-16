import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen } from "./render";
import { StagesBar } from "@/components/diagram/StagesBar";
import { makeStage } from "./fixtures";

function setup(overrides: Partial<Parameters<typeof StagesBar>[0]> = {}) {
  const props = {
    stages: [
      makeStage({ id: "a", name: "300K", sort_order: 0 }),
      makeStage({ id: "b", name: "4K", sort_order: 1 }),
    ],
    onAdd: vi.fn(),
    onRename: vi.fn(),
    onSetTemp: vi.fn(),
    onSetColor: vi.fn(),
    onToggleHidden: vi.fn(),
    onMove: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  return { props, ...renderWithProviders(<StagesBar {...props} />) };
}

describe("StagesBar", () => {
  it("adds a stage", async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole("button", { name: /add stage/i }));
    expect(props.onAdd).toHaveBeenCalledOnce();
  });

  it("toggles hidden", async () => {
    const { props, user } = setup();
    await user.click(screen.getAllByRole("checkbox")[0]);
    expect(props.onToggleHidden).toHaveBeenCalledWith("a", true);
  });

  it("disables move-up for the first stage and move-down for the last", () => {
    setup();
    expect(
      screen.getAllByRole("button", { name: /move stage up/i })[0],
    ).toBeDisabled();
    expect(
      screen.getAllByRole("button", { name: /move stage down/i })[1],
    ).toBeDisabled();
  });

  it("deletes a stage", async () => {
    const { props, user } = setup();
    await user.click(
      screen.getAllByRole("button", { name: /delete stage/i })[1],
    );
    expect(props.onDelete).toHaveBeenCalledWith("b");
  });
});
