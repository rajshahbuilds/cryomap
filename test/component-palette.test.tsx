import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen } from "./render";
import { ComponentPalette } from "@/components/diagram/ComponentPalette";
import { makeCustomComponentDef } from "./fixtures";

const defs = [
  makeCustomComponentDef({ id: "d1", name: "Splitter" }),
  makeCustomComponentDef({ id: "d2", name: "Bias tee" }),
];

describe("ComponentPalette custom def actions", () => {
  it("opens an Edit/Delete menu for a custom def and routes Edit", async () => {
    const onEditCustom = vi.fn();
    const onDeleteCustom = vi.fn();
    const { user } = renderWithProviders(
      <ComponentPalette
        customDefs={defs}
        onStartPlace={vi.fn()}
        onEditCustom={onEditCustom}
        onDeleteCustom={onDeleteCustom}
      />,
    );

    await user.click(screen.getByLabelText("Edit or delete Splitter"));
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));

    expect(onEditCustom).toHaveBeenCalledWith(
      expect.objectContaining({ id: "d1" }),
    );
    expect(onDeleteCustom).not.toHaveBeenCalled();
  });

  it("routes Delete from the menu", async () => {
    const onDeleteCustom = vi.fn();
    const { user } = renderWithProviders(
      <ComponentPalette
        customDefs={defs}
        onStartPlace={vi.fn()}
        onEditCustom={vi.fn()}
        onDeleteCustom={onDeleteCustom}
      />,
    );

    await user.click(screen.getByLabelText("Edit or delete Bias tee"));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(onDeleteCustom).toHaveBeenCalledWith(
      expect.objectContaining({ id: "d2" }),
    );
  });

  it("omits the per-item menu when no edit/delete handlers are given", () => {
    renderWithProviders(
      <ComponentPalette customDefs={defs} onStartPlace={vi.fn()} />,
    );
    expect(
      screen.queryByLabelText("Edit or delete Splitter"),
    ).not.toBeInTheDocument();
  });
});

describe("ComponentPalette component availability", () => {
  it("offers every component regardless of sheet kind", () => {
    renderWithProviders(
      <ComponentPalette customDefs={[]} onStartPlace={vi.fn()} />,
    );
    // Bench instruments, cryogenic parts, and shared passives all appear.
    expect(
      screen.getByRole("button", { name: "Signal Generator" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "VNA" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Thermometer" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "HEMT Amplifier" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Attenuator" }),
    ).toBeInTheDocument();
  });
});
