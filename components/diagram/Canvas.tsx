"use client";

import type { ReactNode } from "react";
import type { CanvasController } from "@/lib/hooks/useCanvas";
import type { Point } from "@/lib/diagram/camera";
import { GRID_SIZE, LOGICAL_HEIGHT, LOGICAL_WIDTH } from "@/lib/diagram/camera";

interface CanvasProps {
  /** Pan/zoom controller from `useCanvas` (lifted so chrome can read zoom). */
  controller: CanvasController;
  /** Logical size of the drawable paper + grid. Defaults to the max space. */
  width?: number;
  height?: number;
  /** Backmost layer, rendered beneath the dot grid (e.g. stage bands). */
  background?: ReactNode;
  /**
   * Double-click on empty canvas (not a component/annotation), in logical
   * coords — e.g. to drop a text note. Ignored when the click lands on content.
   */
  onBackgroundDoubleClick?: (point: Point) => void;
  /** Foreground layers above the grid (line columns, components). */
  children?: ReactNode;
}

/**
 * The diagram canvas shell: a full-bleed SVG with a logical drawing space, a
 * 20px dot grid, and pan/zoom navigation. The paper/grid size (`width`/`height`)
 * is content-derived so the canvas starts compact and grows. `background`
 * renders beneath the grid and `children` above it. The camera lives in the
 * caller-owned `controller` so the toolbar and status bar can read/drive zoom.
 */
export function Canvas({
  controller,
  width = LOGICAL_WIDTH,
  height = LOGICAL_HEIGHT,
  background,
  onBackgroundDoubleClick,
  children,
}: CanvasProps) {
  const { ref, viewBoxString, isPanMode, handlers, toLogical } = controller;

  return (
    <svg
      ref={ref}
      role="presentation"
      viewBox={viewBoxString}
      preserveAspectRatio="xMidYMid meet"
      className={`h-full w-full touch-none select-none ${
        isPanMode ? "cursor-grab active:cursor-grabbing" : "cursor-default"
      }`}
      {...handlers}
      onDoubleClick={(e) => {
        // Only fire on empty canvas: the bare SVG or a `data-canvas-bg` layer
        // (the surface rect, stage bands). Content (components, annotations) is
        // a nested target and is left alone.
        if (!onBackgroundDoubleClick) return;
        const t = e.target as Element;
        if (t === e.currentTarget || t.hasAttribute("data-canvas-bg")) {
          onBackgroundDoubleClick(toLogical(e.clientX, e.clientY));
        }
      }}
    >
      <defs>
        <pattern
          id="dot-grid"
          width={GRID_SIZE}
          height={GRID_SIZE}
          patternUnits="userSpaceOnUse"
        >
          <circle cx={0} cy={0} r={1.6} className="fill-muted" opacity={0.5} />
        </pattern>
      </defs>

      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        data-canvas-bg=""
        className="fill-surface stroke-border"
        strokeWidth={1}
      />

      {background}

      {/* Decorative grid only — must not intercept pointer events, or it would
          swallow hover/drag aimed at the stage-band resize strips beneath it
          (Safari hit-tests pattern fills across their whole bounding box). */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="url(#dot-grid)"
        pointerEvents="none"
      />

      {children}
    </svg>
  );
}
