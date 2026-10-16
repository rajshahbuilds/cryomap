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
import { getLineTypeColor } from "@/lib/constants/lineTypes";
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

  it("renders an ordered colored trunk + label per line", () => {
    const { container } = renderWithProviders(
      <svg>
        <LineColumns lines={lines} height={1000} />
      </svg>,
    );

    const trunks = container.querySelectorAll("line");
    expect(trunks).toHaveLength(2);
    expect(trunks[0].getAttribute("x1")).toBe(String(lineColumnX(0)));
    expect(trunks[0].getAttribute("y2")).toBe("1000");
    expect(trunks[0].getAttribute("stroke")).toBe(getLineTypeColor("xy_drive"));

    expect(screen.getByText("XY 1")).toBeInTheDocument();
    expect(screen.getByText("Flux 1")).toBeInTheDocument();
  });

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
    expect(container.querySelector("line")?.getAttribute("stroke")).toBe(
      "#6b7280",
    );
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

  it("thickens the trunk while its grab strip is hovered", () => {
    const { container } = renderWithProviders(
      <svg>
        <LineColumns lines={movable} height={1000} onStartMove={vi.fn()} />
      </svg>,
    );

    const trunk = container.querySelectorAll("line")[0];
    expect(trunk.getAttribute("stroke-width")).toBe("3");

    const strip = container.querySelector(
      '[data-testid="line-move-strip-l1"]',
    )!;
    fireEvent.pointerEnter(strip);
    expect(trunk.getAttribute("stroke-width")).toBe("5");

    fireEvent.pointerLeave(strip);
    expect(trunk.getAttribute("stroke-width")).toBe("3");
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
