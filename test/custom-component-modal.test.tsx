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
    await user.type(screen.getByLabelText("Port 1 name"), "Input");
    expect(screen.getByLabelText("Port 1 name")).toHaveValue("Inpu");
    await user.clear(screen.getByLabelText("Port 1 name"));
    await user.type(screen.getByLabelText("Port 1 name"), " RF ");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        ports: [
          { side: "left", index: 0, name: "RF" },
          { side: "right", index: 0 },
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
    expect(screen.getByLabelText("Port 1 name")).toHaveValue("Bias");
    await user.selectOptions(screen.getAllByLabelText("Port side")[0], "top");
    await user.clear(screen.getByLabelText("Port 2 name"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        ports: [
          { side: "top", index: 0, name: "Bias" },
          { side: "right", index: 0 },
        ],
      }),
    );
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
