import { describe, it, expect } from "vitest";
import { renderWithProviders, screen } from "./render";
import { FridgeCard } from "@/components/fridge/FridgeCard";
import { makeFridge } from "./fixtures";

describe("FridgeCard", () => {
  it("shows name, vendor/model, last-modified date, and Available when unlocked", () => {
    renderWithProviders(
      <FridgeCard
        fridge={makeFridge()}
        lock={{ active: false, holderName: null }}
      />,
    );

    expect(screen.getByText("DR-1")).toBeInTheDocument();
    expect(screen.getByText("Bluefors · XLD")).toBeInTheDocument();
    expect(screen.getByText(/Jun 18, 2026/)).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
  });

  it("shows the holder name when locked by another user", () => {
    renderWithProviders(
      <FridgeCard
        fridge={makeFridge()}
        lock={{ active: true, holderName: "Ada Lovelace" }}
      />,
    );

    expect(screen.getByText(/In use/)).toBeInTheDocument();
    expect(screen.getByText(/Ada Lovelace/)).toBeInTheDocument();
    expect(screen.queryByText("Available")).not.toBeInTheDocument();
  });

  it("shows the archived badge for archived fridges", () => {
    renderWithProviders(
      <FridgeCard
        fridge={makeFridge({ archived: true })}
        lock={{ active: false, holderName: null }}
      />,
    );

    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("makes the whole card clickable via a stretched title link", () => {
    renderWithProviders(
      <FridgeCard
        fridge={makeFridge()}
        lock={{ active: false, holderName: null }}
      />,
    );

    const link = screen.getByRole("link", { name: "DR-1" });
    expect(link).toHaveAttribute("href", `/fridges/${makeFridge().id}`);
    // The overlay (after:inset-0) is what stretches the hit area over the card.
    expect(link.className).toContain("after:inset-0");
  });

  it("keeps the actions menu as a separate control raised above the overlay", () => {
    renderWithProviders(
      <FridgeCard
        fridge={makeFridge()}
        lock={{ active: false, holderName: null }}
        actions={<button type="button">Menu</button>}
      />,
    );

    // Both the card link and the action remain distinct, reachable elements.
    expect(screen.getByRole("link", { name: "DR-1" })).toBeInTheDocument();
    const action = screen.getByRole("button", { name: "Menu" });
    expect(action).toBeInTheDocument();
    expect(action.closest("div")?.className).toContain("z-10");
  });
});
