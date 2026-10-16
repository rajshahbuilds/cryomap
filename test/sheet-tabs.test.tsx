import { describe, it, expect, vi } from "vitest";
import { SheetTabs } from "@/components/diagram/SheetTabs";
import { renderWithProviders, screen } from "./render";
import { makeSheet } from "./fixtures";

const fridge = makeSheet({ id: "f", kind: "fridge", sort_order: 0 });
const bench = makeSheet({
  id: "b",
  kind: "room_temp",
  name: "Room temp wiring",
  sort_order: 1,
});

describe("SheetTabs", () => {
  it("renders a tab per sheet and marks the active one", () => {
    renderWithProviders(
      <SheetTabs sheets={[fridge, bench]} activeId="b" onSelect={() => {}} />,
    );

    expect(screen.getByText("Fridge wiring")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Room temp wiring" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("button", { name: "Fridge wiring" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("selects a sheet on click", async () => {
    const onSelect = vi.fn();
    const { user } = renderWithProviders(
      <SheetTabs sheets={[fridge, bench]} activeId="f" onSelect={onSelect} />,
    );

    await user.click(screen.getByRole("button", { name: "Room temp wiring" }));
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("offers to delete either kind of sheet", () => {
    renderWithProviders(
      <SheetTabs
        sheets={[fridge, bench]}
        activeId="f"
        onSelect={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Delete sheet Fridge wiring" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete sheet Room temp wiring" }),
    ).toBeInTheDocument();
  });

  it("never offers to delete the last remaining sheet", () => {
    renderWithProviders(
      <SheetTabs
        sheets={[fridge]}
        activeId="f"
        onSelect={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /^Delete sheet/ }),
    ).not.toBeInTheDocument();
  });

  it("adds a sheet of the kind chosen from the ＋ menu", async () => {
    const onAdd = vi.fn();
    const { user } = renderWithProviders(
      <SheetTabs
        sheets={[fridge]}
        activeId="f"
        onSelect={() => {}}
        onAdd={onAdd}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add sheet" }));
    await user.click(screen.getByRole("menuitem", { name: /Fridge wiring/ }));
    expect(onAdd).toHaveBeenCalledWith("fridge");

    await user.click(screen.getByRole("button", { name: "Add sheet" }));
    await user.click(
      screen.getByRole("menuitem", { name: /Room temp wiring/ }),
    );
    expect(onAdd).toHaveBeenCalledWith("room_temp");
  });

  it("closes the ＋ menu on Escape without adding anything", async () => {
    const onAdd = vi.fn();
    const { user } = renderWithProviders(
      <SheetTabs
        sheets={[fridge]}
        activeId="f"
        onSelect={() => {}}
        onAdd={onAdd}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add sheet" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("hides every editing affordance for a read-only viewer", () => {
    renderWithProviders(
      <SheetTabs sheets={[fridge, bench]} activeId="f" onSelect={() => {}} />,
    );

    expect(
      screen.queryByRole("button", { name: "Add sheet" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Delete sheet/ }),
    ).not.toBeInTheDocument();
  });

  it("renames a sheet on double-click, and Escape abandons the edit", async () => {
    const onRename = vi.fn();
    const { user } = renderWithProviders(
      <SheetTabs
        sheets={[fridge, bench]}
        activeId="b"
        onSelect={() => {}}
        onRename={onRename}
      />,
    );

    await user.dblClick(
      screen.getByRole("button", { name: "Room temp wiring" }),
    );
    const input = screen.getByLabelText("Sheet name");
    await user.clear(input);
    await user.type(input, "Renamed sheet{Enter}");
    expect(onRename).toHaveBeenCalledWith("b", "Renamed sheet");

    // The tab is controlled by its props, so it still reads "Room temp wiring"
    // until the parent re-renders with the persisted sheet.
    await user.dblClick(
      screen.getByRole("button", { name: "Room temp wiring" }),
    );
    await user.clear(screen.getByLabelText("Sheet name"));
    await user.keyboard("Abandoned{Escape}");
    expect(onRename).toHaveBeenCalledTimes(1);
  });

  it("ignores a rename that clears the name", async () => {
    const onRename = vi.fn();
    const { user } = renderWithProviders(
      <SheetTabs
        sheets={[bench]}
        activeId="b"
        onSelect={() => {}}
        onRename={onRename}
      />,
    );

    await user.dblClick(
      screen.getByRole("button", { name: "Room temp wiring" }),
    );
    const input = screen.getByLabelText("Sheet name");
    await user.clear(input);
    await user.type(input, "   {Enter}");
    expect(onRename).not.toHaveBeenCalled();
  });
});
