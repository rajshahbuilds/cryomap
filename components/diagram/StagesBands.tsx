"use client";

import { useState } from "react";
import type { Stage } from "@/lib/types";
import { LOGICAL_WIDTH } from "@/lib/diagram/camera";
import { layoutStageBands } from "@/lib/diagram/stages";

/** Subtle alternating band fills for stages without an explicit color. */
const ALT_FILL = ["#ffffff", "#f7f8fa"];

/** Accent used for the resize affordance (matches the canvas drag preview). */
const RESIZE_ACCENT = "#2563eb";

function bandFill(stage: Stage, index: number): string {
  return stage.color ?? ALT_FILL[index % ALT_FILL.length];
}

interface StagesBandsProps {
  stages: Stage[];
  width?: number;
  /** When set, render a draggable resize handle at each band's bottom edge. */
  onStartResize?: (stageId: string, bandTop: number) => void;
}

/**
 * Horizontal temperature-stage bands: full-width rects stacked by `sort_order`,
 * each with a left-side name + temperature label. When editable, each band's
 * bottom divider is a drag handle that resizes the band; hovering it reveals a
 * visible highlight so the affordance is discoverable.
 */
export function StagesBands({
  stages,
  width = LOGICAL_WIDTH,
  onStartResize,
}: StagesBandsProps) {
  const bands = layoutStageBands(stages);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <g data-testid="stage-bands">
      {bands.map(({ stage, y, height }, index) => (
        <g key={stage.id}>
          <rect
            x={0}
            y={y}
            width={width}
            height={height}
            fill={bandFill(stage, index)}
            stroke="#e2e4e9"
            strokeWidth={1}
            data-canvas-bg=""
          />
          <text
            x={24}
            y={y + height / 2 - 4}
            fontSize={18}
            fontWeight={600}
            className="fill-foreground"
          >
            {stage.name}
          </text>
          {stage.nominal_temp ? (
            <text
              x={24}
              y={y + height / 2 + 18}
              fontSize={14}
              className="fill-muted"
            >
              {stage.nominal_temp}
            </text>
          ) : null}
        </g>
      ))}

      {onStartResize
        ? bands.map(({ stage, y, height }) => {
            const divider = y + height;
            const active = hoveredId === stage.id;
            return (
              <g key={`resize-${stage.id}`}>
                {/* Visible affordance: a highlighted divider + a faint band
                    over the grabbable zone, shown while hovered. */}
                {active ? (
                  <>
                    <rect
                      x={0}
                      y={divider - 4}
                      width={width}
                      height={8}
                      fill={RESIZE_ACCENT}
                      opacity={0.12}
                      pointerEvents="none"
                    />
                    <line
                      x1={0}
                      y1={divider}
                      x2={width}
                      y2={divider}
                      stroke={RESIZE_ACCENT}
                      strokeWidth={2}
                      pointerEvents="none"
                    />
                  </>
                ) : null}
                {/* Transparent hit strip that starts the drag. */}
                <rect
                  data-testid={`stage-resize-strip-${stage.id}`}
                  x={0}
                  y={divider - 4}
                  width={width}
                  height={8}
                  fill="transparent"
                  style={{ cursor: "row-resize" }}
                  onPointerEnter={() => setHoveredId(stage.id)}
                  onPointerLeave={() =>
                    setHoveredId((h) => (h === stage.id ? null : h))
                  }
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onStartResize(stage.id, y);
                  }}
                />
              </g>
            );
          })
        : null}
    </g>
  );
}
