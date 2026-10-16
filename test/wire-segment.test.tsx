import { describe, it, expect, vi } from "vitest";
import { renderWithProviders } from "./render";
import { WireSegment, WireSegments } from "@/components/diagram/WireSegment";
import type { Wire } from "@/lib/diagram/wires";

describe("WireSegment", () => {
  it("renders a path along the two points", () => {
    const { container } = renderWithProviders(
      <svg>
        <WireSegment from={{ x: 10, y: 20 }} to={{ x: 10, y: 80 }} />
      </svg>,
    );
    const path = container.querySelector("path");
    expect(path?.getAttribute("d")).toBe("M 10 20 L 10 80");
    expect(path?.getAttribute("stroke-dasharray")).toBeNull();
  });

  it("renders explicit segments as a solid black line", () => {
    const { container } = renderWithProviders(
      <svg>
        <WireSegment
          from={{ x: 0, y: 0 }}
          to={{ x: 40, y: 40 }}
          variant="explicit"
        />
      </svg>,
    );
    const path = container.querySelector("path");
    expect(path?.getAttribute("stroke")).toBe("#1a1d27");
    expect(path?.getAttribute("stroke-dasharray")).toBeNull();
  });

  it("uses a provided (orthogonal) path verbatim", () => {
    const { container } = renderWithProviders(
      <svg>
        <WireSegment
          from={{ x: 0, y: 0 }}
          to={{ x: 40, y: 40 }}
          path="M 0 0 H 20 V 40 H 40"
        />
      </svg>,
    );
    expect(container.querySelector("path")?.getAttribute("d")).toBe(
      "M 0 0 H 20 V 40 H 40",
    );
  });

  it("invokes onSelect when the fat hit-path is clicked", async () => {
    const onSelect = vi.fn();
    const { container, user } = renderWithProviders(
      <svg>
        <WireSegment
          from={{ x: 0, y: 0 }}
          to={{ x: 40, y: 40 }}
          variant="explicit"
          onSelect={onSelect}
        />
      </svg>,
    );
    const hit = container.querySelector('path[stroke="transparent"]')!;
    await user.click(hit);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("layer='visual' draws the line but no clickable hit-path", () => {
    const onSelect = vi.fn();
    const { container } = renderWithProviders(
      <svg>
        <WireSegment
          from={{ x: 0, y: 0 }}
          to={{ x: 40, y: 40 }}
          variant="explicit"
          layer="visual"
          onSelect={onSelect}
        />
      </svg>,
    );
    expect(container.querySelector('path[stroke="transparent"]')).toBeNull();
    const visible = container.querySelector("path");
    expect(visible?.getAttribute("pointer-events")).toBe("none");
  });

  it("layer='hit' draws only the clickable hit-path", async () => {
    const onSelect = vi.fn();
    const { container, user } = renderWithProviders(
      <svg>
        <WireSegment
          from={{ x: 0, y: 0 }}
          to={{ x: 40, y: 40 }}
          variant="explicit"
          layer="hit"
          onSelect={onSelect}
        />
      </svg>,
    );
    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(1);
    await user.click(paths[0]);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("renders a highlight beneath the wire when selected", () => {
    const { container } = renderWithProviders(
      <svg>
        <WireSegment
          from={{ x: 0, y: 0 }}
          to={{ x: 40, y: 40 }}
          variant="explicit"
          selected
          onSelect={vi.fn()}
        />
      </svg>,
    );
    // highlight + visible + hit path
    expect(container.querySelectorAll("path")).toHaveLength(3);
    expect(
      container.querySelector('path[stroke-width="6"]'),
    ).toBeInTheDocument();
  });
});

describe("WireSegments", () => {
  const wires: Wire[] = [
    { key: "w1", from: { x: 0, y: 0 }, to: { x: 0, y: 50 } },
    { key: "w2", from: { x: 0, y: 50 }, to: { x: 0, y: 100 } },
  ];

  it("renders a path per wire", () => {
    const { container } = renderWithProviders(
      <svg>
        <WireSegments wires={wires} />
      </svg>,
    );
    expect(container.querySelectorAll("path")).toHaveLength(2);
    expect(
      container.querySelector('[data-testid="wires-implicit"]'),
    ).toBeInTheDocument();
  });

  it("matches the rendered snapshot", () => {
    const { container } = renderWithProviders(
      <svg>
        <WireSegments wires={wires} />
      </svg>,
    );
    expect(
      container.querySelector('[data-testid="wires-implicit"]')?.innerHTML,
    ).toMatchSnapshot();
  });
});
