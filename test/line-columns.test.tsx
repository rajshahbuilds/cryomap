import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen } from "./render";
import {
  COLUMN_WIDTH,
  LINE_AREA_LEFT,
  layoutLineColumns,
  lineColumnX,
} from "@/lib/diagram/lines";
import { LineColumns } from "@/components/diagram/LineColumns";
import { LINE_ENDPOINT_Y } from "@/lib/diagram/lineConnections";
import { makeLine } from "./fixtures";

describe("lineColumnX", () => {
  it("places the i-th trunk one default gap past the previous", () => {
    expect(lineColumnX(0)).toBe(LINE_AREA_LEFT + COLUMN_WIDTH);
    expect(lineColumnX(2)).toBe(LINE_AREA_LEFT + 3 * COLUMN_WIDTH);
  });
});

describe("layoutLineColumns", () => {
  it("orders by sort_order and lays trunks out left-to-right", () => {
    const cols = layoutLineColumns([
      makeLine({ id: "b", name: "B", sort_order: 2 }),
      makeLine({ id: "a", name: "A", sort_order: 0 }),
    ]);
    expect(cols.map((c) => c.line.name)).toEqual(["A", "B"]);
    // Default-gap trunks sit at consecutive slots regardless of sort_order
    // gaps (no phantom space from the missing sort_order 1).
    expect(cols.map((c) => c.x)).toEqual([lineColumnX(0), lineColumnX(1)]);
  });

  it("accumulates each line's gap so trunks reflow", () => {
    const cols = layoutLineColumns([
      makeLine({ id: "a", sort_order: 0, width_px: 100 }),
      makeLine({ id: "b", sort_order: 1, width_px: 200 }),
      makeLine({ id: "c", sort_order: 2, width_px: 120 }),
    ]);
    expect(cols.map((c) => c.x)).toEqual([
      LINE_AREA_LEFT + 100, // gutter + gap A
      LINE_AREA_LEFT + 100 + 200, // + gap B
      LINE_AREA_LEFT + 300 + 120, // + gap C
    ]);
    // Each trunk's `prevX` is the trunk before it (gutter for the first).
    expect(cols.map((c) => c.prevX)).toEqual([
      LINE_AREA_LEFT,
      LINE_AREA_LEFT + 100,
      LINE_AREA_LEFT + 300,
    ]);
  });
});

describe("LineColumns", () => {
  const lines = [
    makeLine({ id: "l1", name: "XY 1", sort_order: 0, line_type: "xy_drive" }),
    makeLine({ id: "l2", name: "Flux 1", sort_order: 1, line_type: "flux_z" }),
  ];

  it("renders a directional endpoint and label without a full-height electrical trunk", () => {
    const { container } = renderWithProviders(
      <svg>
        <LineColumns lines={lines} height={1000} />
      </svg>,
    );

    expect(container.querySelectorAll('line[y2="1000"]')).toHaveLength(0);
    const endpoint = screen.getByRole("img", {
      name: "XY 1: Input line endpoint",
    });
    expect(endpoint.querySelector("circle")?.getAttribute("cx")).toBe(
      String(lineColumnX(0)),
    );
    expect(
      endpoint.querySelector('[data-component-type="input_port"] polygon'),
    ).not.toBeNull();
    expect(endpoint.querySelector("circle")).toHaveAttribute(
      "cy",
      String(LINE_ENDPOINT_Y),
    );

    expect(screen.getByText("XY 1")).toBeInTheDocument();
    expect(screen.getByText("Flux 1")).toBeInTheDocument();
  });

  it.each(["input", "output", "bidirectional"] as const)(
    "shows and selects a %s endpoint with keyboard access",
    async (direction) => {
      const onSelectLine = vi.fn();
      const { user } = renderWithProviders(
        <svg>
          <LineColumns
            lines={[makeLine({ id: "endpoint", name: "Signal", direction })]}
            onSelectLine={onSelectLine}
          />
        </svg>,
      );
      const endpoint = screen.getByRole("button", {
        name: /Signal: .* line endpoint/,
      });
      expect(endpoint).toHaveAttribute("data-direction", direction);
      const type =
        direction === "bidirectional" ? "bidir_port" : `${direction}_port`;
      expect(
        endpoint.querySelector(`[data-component-type="${type}"] polygon`),
      ).not.toBeNull();
      endpoint.focus();
      await user.keyboard("{Enter}");
      expect(onSelectLine).toHaveBeenCalledWith("endpoint");
    },
  );

  it("hides the label when show_label is false", () => {
    renderWithProviders(
      <svg>
        <LineColumns
          lines={[
            makeLine({ id: "h", name: "Hidden label", show_label: false }),
          ]}
        />
      </svg>,
    );
    expect(screen.queryByText("Hidden label")).not.toBeInTheDocument();
  });

  it("falls back to a neutral trunk color for untyped lines", () => {
    const { container } = renderWithProviders(
      <svg>
        <LineColumns lines={[makeLine({ id: "u", line_type: null })]} />
      </svg>,
    );
    expect(container.querySelector("text")).toHaveAttribute("fill", "#6b7280");
  });
});

describe("LineColumns move", () => {
  const movable = [
    makeLine({ id: "l1", name: "A", sort_order: 0, width_px: 120 }),
    makeLine({ id: "l2", name: "B", sort_order: 1, width_px: 120 }),
  ];

  it("renders no move handles when not editable", () => {
    const { container } = renderWithProviders(
      <svg>
        <LineColumns lines={movable} />
      </svg>,
    );
    expect(
      container.querySelector('[data-testid^="line-move-strip-"]'),
    ).toBeNull();
  });

  it("emphasizes the editing guide while its grab strip is hovered", () => {
    const { container } = renderWithProviders(
      <svg>
        <LineColumns
          lines={movable}
          height={1000}
          showGuides
          onStartMove={vi.fn()}
        />
      </svg>,
    );

    const trunk = container.querySelectorAll("line")[0];
    expect(trunk.getAttribute("opacity")).toBe("0.12");

    const strip = container.querySelector(
      '[data-testid="line-move-strip-l1"]',
    )!;
    fireEvent.pointerEnter(strip);
    expect(trunk.getAttribute("opacity")).toBe("0.35");

    fireEvent.pointerLeave(strip);
    expect(trunk.getAttribute("opacity")).toBe("0.12");
  });

  it("starts a move with the previous trunk's x", () => {
    const onStartMove = vi.fn();
    const { container } = renderWithProviders(
      <svg>
        <LineColumns lines={movable} onStartMove={onStartMove} />
      </svg>,
    );

    const strip = container.querySelector(
      '[data-testid="line-move-strip-l1"]',
    )!;
    fireEvent.pointerDown(strip);
    // l1 is first, so the "previous trunk" is the left gutter (200).
    expect(onStartMove).toHaveBeenCalledWith("l1", 200);
  });

  it("selects a line by clicking anywhere on its trunk when read-only", () => {
    // No onStartMove (read-only): the whole trunk is a click target so viewers
    // can select a line to trace its chains.
    const onSelectLine = vi.fn();
    const { container } = renderWithProviders(
      <svg>
        <LineColumns lines={movable} onSelectLine={onSelectLine} />
      </svg>,
    );
    // The drag strip is absent; a plain select strip takes its place.
    expect(
      container.querySelector('[data-testid="line-move-strip-l1"]'),
    ).toBeNull();
    fireEvent.click(
      container.querySelector('[data-testid="line-select-strip-l2"]')!,
    );
    expect(onSelectLine).toHaveBeenCalledWith("l2");
  });
});
