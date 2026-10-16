import { describe, it, expect, beforeAll, vi } from "vitest";
import { useState } from "react";
import { act, render } from "@testing-library/react";
import { useCanvas } from "@/lib/hooks/useCanvas";
import { Canvas } from "@/components/diagram/Canvas";

// jsdom has no ResizeObserver; a no-op stub is enough (we don't assert sizing).
beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

/**
 * Mirrors the editor: `useCanvas` is owned here and mounts *before* the canvas
 * SVG exists (the diagram "loads" first). This is the case that regressed when
 * the hook was lifted out of `Canvas` — the wheel listener must still attach
 * once the SVG appears.
 */
function DeferredCanvas() {
  const canvas = useCanvas();
  const [ready, setReady] = useState(false);
  return (
    <div>
      <button onClick={() => setReady(true)}>load</button>
      {ready ? <Canvas controller={canvas} /> : <p>loading…</p>}
    </div>
  );
}

function fireWheel(svg: SVGSVGElement, init: WheelEventInit) {
  act(() => {
    svg.dispatchEvent(
      new WheelEvent("wheel", { cancelable: true, bubbles: true, ...init }),
    );
  });
}

describe("useCanvas wheel navigation", () => {
  it("attaches the wheel listener when the SVG mounts after the hook", () => {
    const { container, getByText } = render(<DeferredCanvas />);

    // Canvas not mounted yet (the loading branch is showing).
    expect(container.querySelector("svg")).toBeNull();

    act(() => getByText("load").click());
    const svg = container.querySelector("svg")!;
    expect(svg).not.toBeNull();

    // Pinch / ⌘-Ctrl+scroll zooms: the viewBox width should shrink.
    const before = svg.getAttribute("viewBox")!;
    fireWheel(svg, { deltaY: -100, ctrlKey: true });
    const after = svg.getAttribute("viewBox")!;

    expect(after).not.toEqual(before);
    expect(widthOf(after)).toBeLessThan(widthOf(before));
  });

  it("pans (shifts the viewBox origin) on a plain scroll", () => {
    const { container, getByText } = render(<DeferredCanvas />);
    act(() => getByText("load").click());
    const svg = container.querySelector("svg")!;

    const before = svg.getAttribute("viewBox")!;
    fireWheel(svg, { deltaX: 40, deltaY: 25 });
    const after = svg.getAttribute("viewBox")!;

    expect(after).not.toEqual(before);
    // Pan keeps the zoom (viewBox size) the same, only the origin moves.
    expect(widthOf(after)).toEqual(widthOf(before));
  });
});

function widthOf(viewBox: string): number {
  return Number(viewBox.split(" ")[2]);
}
