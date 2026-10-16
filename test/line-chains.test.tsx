import { describe, it, expect, vi, afterEach } from "vitest";
import { renderWithProviders, screen, cleanup } from "./render";
import { LineChains } from "@/components/diagram/LineChains";
import type { TracedChain } from "@/lib/diagram/trace";
import { makeComponent } from "./fixtures";

afterEach(cleanup);

const box = (id: string, label: string, sheetId = "rt") =>
  makeComponent({ id, label, value: null, sheet_id: sheetId });

const chain = (
  endpointId: string,
  hops: string[][],
  fridge: string[][] = [],
): TracedChain => ({
  endpointId,
  lineId: "L1",
  sheetId: "rt",
  hops: hops.map(([id, label]) => box(id, label)),
  fridge: fridge.map(([id, label]) => box(id, label, "fridge")),
  oriented: true,
});

describe("LineChains", () => {
  it("renders each hop then the line name, hops clickable", () => {
    const onJump = vi.fn();
    renderWithProviders(
      <LineChains
        lineName="2B"
        chains={[
          chain("P", [
            ["a", "SigGen"],
            ["b", "BLK-18-S+"],
          ]),
        ]}
        customDefById={new Map()}
        onJump={onJump}
      />,
    );
    expect(screen.getByRole("button", { name: "SigGen" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "BLK-18-S+" }),
    ).toBeInTheDocument();
    // The line name is the terminal (not a button).
    expect(screen.getByText("2B")).toBeInTheDocument();

    screen.getByRole("button", { name: "SigGen" }).click();
    expect(onJump).toHaveBeenCalledWith("a", "rt");
  });

  it("continues through the fridge components instead of the line badge", () => {
    const onJump = vi.fn();
    renderWithProviders(
      <LineChains
        lineName="2B"
        chains={[
          chain(
            "P",
            [["a", "DIO Module"]],
            [
              ["att4k", "Attenuator (-20 dB)"],
              ["attmxc", "Attenuator (-10 dB)"],
            ],
          ),
        ]}
        customDefById={new Map()}
        onJump={onJump}
      />,
    );
    // Bench hop plus each fridge-stage component, all clickable.
    expect(
      screen.getByRole("button", { name: "DIO Module" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Attenuator (-20 dB)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Attenuator (-10 dB)" }),
    ).toBeInTheDocument();
    // The redundant "2B" line badge is gone once real fridge hops exist.
    expect(screen.queryByText("2B")).not.toBeInTheDocument();
    // A fridge hop jumps to its own (fridge) sheet.
    screen.getByRole("button", { name: "Attenuator (-20 dB)" }).click();
    expect(onJump).toHaveBeenCalledWith("att4k", "fridge");
  });

  it("lists two chains that terminate at the same line", () => {
    renderWithProviders(
      <LineChains
        lineName="2B"
        chains={[
          chain("P1", [["a", "Input"]]),
          chain("P2", [["b", "Readout"]]),
        ]}
        customDefById={new Map()}
        onJump={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Input" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Readout" })).toBeInTheDocument();
  });

  it("shows an empty state when nothing links to the line", () => {
    renderWithProviders(
      <LineChains
        lineName="2B"
        chains={[]}
        customDefById={new Map()}
        onJump={vi.fn()}
      />,
    );
    expect(screen.getByText(/No bench chain links/i)).toBeInTheDocument();
  });
});
