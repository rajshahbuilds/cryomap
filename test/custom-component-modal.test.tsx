import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, fireEvent } from "./render";
import { CustomComponentModal } from "@/components/diagram/CustomComponentModal";
import { defToFormValues } from "@/lib/diagram/customDef";
import { makeCustomComponentDef } from "./fixtures";

describe("custom component port names", () => {
  it("limits typing to four characters, trims names, and leaves other ports unnamed", async () => {
    const onSubmit = vi.fn();
    const { user } = renderWithProviders(
      <CustomComponentModal
        mode="create"
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText("Name", { exact: true }), "Mixer");
    await user.type(screen.getByLabelText("Pin 1 name"), "Input");
    expect(screen.getByLabelText("Pin 1 name")).toHaveValue("Inpu");
    await user.clear(screen.getByLabelText("Pin 1 name"));
    await user.type(screen.getByLabelText("Pin 1 name"), " RF ");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        ports: [
          { side: "left", index: 0, name: "RF", pin_number: 1 },
          { side: "right", index: 0, pin_number: 2 },
        ],
      }),
    );
  });

  it("preserves existing names when moving a port, and permits clearing them", async () => {
    const onSubmit = vi.fn();
    const initial = defToFormValues(
      makeCustomComponentDef({
        ports: [
          { side: "left", index: 0, name: "Bias" },
          { side: "right", index: 0, name: "OUT" },
        ],
      }),
    );
    const { user } = renderWithProviders(
      <CustomComponentModal
        mode="edit"
        initial={initial}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Pin 1 name")).toHaveValue("Bias");
    await user.selectOptions(screen.getByLabelText("Pin 1 side"), "top");
    await user.clear(screen.getByLabelText("Pin 2 name"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        ports: [
          { side: "top", index: 0, name: "Bias", pin_number: 1 },
          { side: "right", index: 0, pin_number: 2 },
        ],
      }),
    );
  });

  it("assigns pins across the whole part without editable order fields", async () => {
    const onSubmit = vi.fn();
    const { user } = renderWithProviders(
      <CustomComponentModal
        mode="create"
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText("Name", { exact: true }), "Chip");
    expect(screen.getByText("Pin 1", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Pin 2", { exact: true })).toBeInTheDocument();
    expect(screen.queryByLabelText("Port index")).not.toBeInTheDocument();
    // Width and height are the only number inputs.
    expect(screen.getAllByRole("spinbutton")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "+ Pin" }));
    await user.type(screen.getByLabelText("Pin 3 name"), "SCLK");
    await user.selectOptions(screen.getByLabelText("Pin 3 side"), "right");
    expect(screen.getByLabelText("Pin 3 name")).toHaveValue("SCLK");
    await user.click(screen.getByRole("button", { name: "Remove pin 2" }));
    expect(screen.getByText("Pin 3", { exact: true })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "+ Pin" }));
    expect(screen.getByText("Pin 4", { exact: true })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create" }));
    const saved = onSubmit.mock.calls[0][0];
    expect(
      saved.ports.map((p: { pin_number: number }) => p.pin_number),
    ).toEqual([1, 3, 4]);
    expect(
      saved.ports.find((p: { pin_number: number }) => p.pin_number === 3),
    ).toMatchObject({ name: "SCLK", side: "right" });
    expect(
      new Set(
        saved.ports.map(
          (p: { side: string; index: number }) => `${p.side}:${p.index}`,
        ),
      ).size,
    ).toBe(3);
  });

  it("keeps saved pin numbers when reopening a definition", async () => {
    const onSubmit = vi.fn();
    const initial = defToFormValues(
      makeCustomComponentDef({
        ports: [
          { side: "left", index: 5, pin_number: 2, name: "SCLK" },
          { side: "right", index: 9, pin_number: 7 },
        ],
      }),
    );
    const { user } = renderWithProviders(
      <CustomComponentModal
        mode="edit"
        initial={initial}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Pin 2 name")).toHaveValue("SCLK");
    expect(screen.getByText("Pin 7", { exact: true })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "+ Pin" }));
    expect(screen.getByText("Pin 8", { exact: true })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit.mock.calls[0][0].ports.slice(0, 2)).toEqual(initial.ports);
  });

  it("rejects overlength names even when the input limit is bypassed", () => {
    const onSubmit = vi.fn();
    const initial = defToFormValues(
      makeCustomComponentDef({
        ports: [{ side: "left", index: 0, name: "INPUT" }],
      }),
    );
    renderWithProviders(
      <CustomComponentModal
        mode="edit"
        initial={initial}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );
    fireEvent.submit(
      screen.getByRole("button", { name: "Save" }).closest("form")!,
    );
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Port names must be 4 characters or fewer.",
    );
  });
});
