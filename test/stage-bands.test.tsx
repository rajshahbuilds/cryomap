import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen } from "./render";
import { layoutStageBands, stagesHeight } from "@/lib/diagram/stages";
import { StagesBands } from "@/components/diagram/StagesBands";
import { makeStage } from "./fixtures";

const stages = [
  makeStage({ id: "s2", name: "50K", sort_order: 1, height_px: 100 }),
  makeStage({ id: "s1", name: "300K", sort_order: 0, height_px: 120 }),
  makeStage({ id: "s3", name: "4K", sort_order: 2, height_px: 80 }),
];

describe("layoutStageBands", () => {
  it("orders by sort_order with cumulative y-offsets", () => {
    const bands = layoutStageBands(stages);
    expect(bands.map((b) => b.stage.name)).toEqual(["300K", "50K", "4K"]);
    expect(bands.map((b) => b.y)).toEqual([0, 120, 220]);
    expect(bands.map((b) => b.height)).toEqual([120, 100, 80]);
  });

  it("excludes hidden stages from the layout and total height", () => {
    const withHidden = [
      ...stages,
      makeStage({ id: "s4", name: "Still", sort_order: 3, hidden: true }),
    ];
    const bands = layoutStageBands(withHidden);
    expect(bands.map((b) => b.stage.name)).toEqual(["300K", "50K", "4K"]);
    expect(stagesHeight(withHidden)).toBe(300);
  });
});

describe("StagesBands", () => {
  it("renders a band rect + name/temperature label per visible stage", () => {
    const { container } = renderWithProviders(
      <svg>
        <StagesBands stages={stages} />
      </svg>,
    );

    const rects = container.querySelectorAll("rect");
    expect(rects).toHaveLength(3);
    // Bands stack: the second rect begins where the first (120px) ends.
    expect(rects[0].getAttribute("y")).toBe("0");
    expect(rects[1].getAttribute("y")).toBe("120");

    expect(screen.getByText("300K")).toBeInTheDocument();
    expect(screen.getByText("4K")).toBeInTheDocument();
    // Each visible band carries its temperature label (default fixture: 10 mK).
    expect(screen.getAllByText(/mK/)).toHaveLength(3);
  });

  it("renders no resize handles when not editable", () => {
    const { container } = renderWithProviders(
      <svg>
        <StagesBands stages={stages} />
      </svg>,
    );
    expect(
      container.querySelector('[data-testid^="stage-resize-strip-"]'),
    ).toBeNull();
  });

  it("reveals a divider highlight when a resize handle is hovered", () => {
    const onStartResize = vi.fn();
    const { container } = renderWithProviders(
      <svg>
        <StagesBands stages={stages} onStartResize={onStartResize} />
      </svg>,
    );

    const strip = container.querySelector(
      '[data-testid="stage-resize-strip-s1"]',
    )!;
    expect(container.querySelector("line")).toBeNull();

    fireEvent.pointerEnter(strip);
    // The highlight line sits at the band's bottom divider (300K band = 120px).
    const line = container.querySelector("line");
    expect(line).not.toBeNull();
    expect(line!.getAttribute("y1")).toBe("120");

    fireEvent.pointerLeave(strip);
    expect(container.querySelector("line")).toBeNull();
  });

  it("starts a resize from the handle's band top", () => {
    const onStartResize = vi.fn();
    const { container } = renderWithProviders(
      <svg>
        <StagesBands stages={stages} onStartResize={onStartResize} />
      </svg>,
    );

    const strip = container.querySelector(
      '[data-testid="stage-resize-strip-s1"]',
    )!;
    fireEvent.pointerDown(strip);
    // 300K is the top band, so its top edge is y = 0.
    expect(onStartResize).toHaveBeenCalledWith("s1", 0);
  });

  it("does not render hidden stages", () => {
    const { container } = renderWithProviders(
      <svg>
        <StagesBands
          stages={[
            makeStage({ id: "v", name: "Visible", sort_order: 0 }),
            makeStage({ id: "h", name: "Ghost", sort_order: 1, hidden: true }),
          ]}
        />
      </svg>,
    );

    expect(container.querySelectorAll("rect")).toHaveLength(1);
    expect(screen.queryByText("Ghost")).not.toBeInTheDocument();
  });
});
