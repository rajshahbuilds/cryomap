import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen } from "./render";
import { Toolbar } from "@/components/diagram/Toolbar";

describe("Toolbar", () => {
  it("offers checkout when unlocked", async () => {
    const onCheckOut = vi.fn();
    const { user } = renderWithProviders(
      <Toolbar
        lockState="UNLOCKED"
        onCheckOut={onCheckOut}
        onRelease={vi.fn()}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /check out to edit/i }),
    );
    expect(onCheckOut).toHaveBeenCalledOnce();
  });

  it("shows a view-only badge (no checkout) when the role can't edit", () => {
    renderWithProviders(
      <Toolbar
        lockState="UNLOCKED"
        canCheckOut={false}
        onCheckOut={vi.fn()}
        onRelease={vi.fn()}
      />,
    );
    expect(screen.getByText("View only")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /check out to edit/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the Editing badge with Check In / Discard when held by me", async () => {
    const onRelease = vi.fn();
    const onCheckIn = vi.fn();
    const { user } = renderWithProviders(
      <Toolbar
        lockState="LOCKED_BY_ME"
        onCheckOut={vi.fn()}
        onRelease={onRelease}
        onCheckIn={onCheckIn}
      />,
    );
    expect(screen.getByText("Editing")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /check in/i }));
    expect(onCheckIn).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: /discard/i }));
    expect(onRelease).toHaveBeenCalledOnce();
  });

  it("shows read-only and no actions when held by another", () => {
    renderWithProviders(
      <Toolbar
        lockState="LOCKED_BY_OTHER"
        onCheckOut={vi.fn()}
        onRelease={vi.fn()}
      />,
    );
    expect(screen.getByText("Read-only")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("edits the fridge name and commits on Enter", async () => {
    const onRenameFridge = vi.fn();
    const { user } = renderWithProviders(
      <Toolbar
        lockState="LOCKED_BY_ME"
        fridgeName="Bluefors XLD"
        onRenameFridge={onRenameFridge}
        onCheckOut={vi.fn()}
        onRelease={vi.fn()}
      />,
    );
    const input = screen.getByRole("textbox", { name: /fridge name/i });
    await user.clear(input);
    await user.type(input, "Triton 200{Enter}");
    expect(onRenameFridge).toHaveBeenCalledWith("Triton 200");
  });

  it("shows the name read-only when no rename handler is given", () => {
    renderWithProviders(
      <Toolbar
        lockState="LOCKED_BY_OTHER"
        fridgeName="Bluefors XLD"
        onCheckOut={vi.fn()}
        onRelease={vi.fn()}
      />,
    );
    expect(screen.getByText("Bluefors XLD")).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: /fridge name/i }),
    ).not.toBeInTheDocument();
  });

  it("wires zoom controls and shows the current percentage", async () => {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onZoomReset = vi.fn();
    const { user } = renderWithProviders(
      <Toolbar
        lockState="UNLOCKED"
        zoomPercent={150}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onZoomReset={onZoomReset}
        onCheckOut={vi.fn()}
        onRelease={vi.fn()}
      />,
    );
    expect(screen.getByText("150%")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /zoom in/i }));
    await user.click(screen.getByRole("button", { name: /zoom out/i }));
    await user.click(screen.getByRole("button", { name: /reset zoom/i }));
    expect(onZoomIn).toHaveBeenCalledOnce();
    expect(onZoomOut).toHaveBeenCalledOnce();
    expect(onZoomReset).toHaveBeenCalledOnce();
  });

  it("disables check-out and shows an offline indicator when offline", () => {
    renderWithProviders(
      <Toolbar
        lockState="UNLOCKED"
        offline
        onCheckOut={vi.fn()}
        onRelease={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /check out to edit/i }),
    ).toBeDisabled();
    expect(screen.getByText("Offline")).toBeInTheDocument();
  });

  it("disables check-in when offline", () => {
    renderWithProviders(
      <Toolbar
        lockState="LOCKED_BY_ME"
        offline
        onCheckOut={vi.fn()}
        onRelease={vi.fn()}
        onCheckIn={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /check in/i })).toBeDisabled();
  });

  it("exports the chosen format from the export menu", async () => {
    const onExport = vi.fn();
    const { user } = renderWithProviders(
      <Toolbar
        lockState="UNLOCKED"
        showExport
        onExport={onExport}
        onCheckOut={vi.fn()}
        onRelease={vi.fn()}
      />,
    );
    await user.click(screen.getByText(/^Export ▾$/));
    await user.click(screen.getByRole("menuitem", { name: /png image/i }));
    expect(onExport).toHaveBeenCalledWith("png");

    await user.click(screen.getByText(/^Export ▾$/));
    await user.click(screen.getByRole("menuitem", { name: /pdf document/i }));
    expect(onExport).toHaveBeenCalledWith("pdf");

    await user.click(screen.getByText(/^Export ▾$/));
    await user.click(screen.getByRole("menuitem", { name: /json snapshot/i }));
    expect(onExport).toHaveBeenCalledWith("json");
  });

  it("disables export menu items while a capture is in flight", () => {
    renderWithProviders(
      <Toolbar
        lockState="UNLOCKED"
        showExport
        exporting
        onExport={vi.fn()}
        onCheckOut={vi.fn()}
        onRelease={vi.fn()}
      />,
    );
    expect(screen.getByText(/^Exporting… ▾$/)).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /png image/i })).toBeDisabled();
  });

  it("hides the export menu without an onExport handler", () => {
    renderWithProviders(
      <Toolbar
        lockState="UNLOCKED"
        showExport
        onCheckOut={vi.fn()}
        onRelease={vi.fn()}
      />,
    );
    expect(screen.queryByText(/export/i)).not.toBeInTheDocument();
  });
});
