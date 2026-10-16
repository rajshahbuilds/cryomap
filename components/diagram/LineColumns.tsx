"use client";

import { useState } from "react";
import type { Line } from "@/lib/types";
import { LOGICAL_HEIGHT } from "@/lib/diagram/camera";
import { layoutLineColumns } from "@/lib/diagram/lines";
import { getLineTypeColor } from "@/lib/constants/lineTypes";

/** Trunk color for untyped lines. */
const DEFAULT_LINE_COLOR = "#6b7280";

/** Width of the invisible grab strip centered on each trunk. */
const GRAB_WIDTH = 16;

function trunkColor(line: Line): string {
  return line.line_type ? getLineTypeColor(line.line_type) : DEFAULT_LINE_COLOR;
}

interface LineColumnsProps {
  lines: Line[];
  /** Trunk height in logical units (defaults to the full logical space). */
  height?: number;
  /** Line ids to emphasize (e.g. lines of selected components). */
  highlightLineIds?: string[];
  /** Select a line by clicking its label. */
  onSelectLine?: (lineId: string) => void;
  /**
   * When set, the trunk itself is draggable: grab a line and slide it left or
   * right to change its gap. Receives the line id and the previous trunk's x
   * (the line can't be dragged closer than the minimum gap to it).
   */
  onStartMove?: (lineId: string, prevTrunkX: number) => void;
}

/**
 * Vertical signal-line columns: a thin colored trunk per line, ordered by
 * `sort_order`, with an optional top label. When editable, hovering a trunk
 * thickens it and turns the cursor into a horizontal-move affordance; dragging
 * slides the line (and reflows the lines to its right).
 */
export function LineColumns({
  lines,
  height = LOGICAL_HEIGHT,
  highlightLineIds = [],
  onSelectLine,
  onStartMove,
}: LineColumnsProps) {
  const columns = layoutLineColumns(lines);
  const highlighted = new Set(highlightLineIds);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <g data-testid="line-columns">
      {columns.map(({ line, x, prevX }) => {
        const color = trunkColor(line);
        const isHighlighted = highlighted.has(line.id);
        const isHovered = onStartMove != null && hoveredId === line.id;
        return (
          <g key={line.id}>
            <line
              x1={x}
              y1={0}
              x2={x}
              y2={height}
              stroke={color}
              strokeWidth={isHighlighted || isHovered ? 5 : 3}
              opacity={isHighlighted || isHovered ? 1 : 0.85}
            />
            {line.show_label ? (
              <text
                x={x}
                y={18}
                textAnchor="middle"
                fontSize={14}
                fontWeight={600}
                fill={color}
                stroke="#ffffff"
                strokeWidth={3}
                paintOrder="stroke"
                style={{ cursor: onSelectLine ? "pointer" : undefined }}
                onClick={
                  onSelectLine
                    ? (e) => {
                        e.stopPropagation();
                        onSelectLine(line.id);
                      }
                    : undefined
                }
              >
                {line.name}
              </text>
            ) : null}
            {/* Invisible grab strip over the trunk. When editable it starts a
                drag-move (a no-drag click selects the line, handled by the
                editor). Read-only, it's a plain click target so viewers can
                still select a line to trace its chains. */}
            {onStartMove ? (
              <rect
                data-testid={`line-move-strip-${line.id}`}
                x={x - GRAB_WIDTH / 2}
                y={0}
                width={GRAB_WIDTH}
                height={height}
                fill="transparent"
                style={{ cursor: "ew-resize" }}
                onPointerEnter={() => setHoveredId(line.id)}
                onPointerLeave={() =>
                  setHoveredId((h) => (h === line.id ? null : h))
                }
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onStartMove(line.id, prevX);
                }}
              />
            ) : onSelectLine ? (
              <rect
                data-testid={`line-select-strip-${line.id}`}
                x={x - GRAB_WIDTH / 2}
                y={0}
                width={GRAB_WIDTH}
                height={height}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectLine(line.id);
                }}
              />
            ) : null}
          </g>
        );
      })}
    </g>
  );
}
