"use client";

import { useState } from "react";
import type { Line } from "@/lib/types";
import { LOGICAL_HEIGHT } from "@/lib/diagram/camera";
import { layoutLineColumns } from "@/lib/diagram/lines";
import { getLineTypeColor } from "@/lib/constants/lineTypes";
import { COMPONENT_LIBRARY } from "@/lib/constants/componentLibrary";
import { SYMBOL_GLYPHS } from "./symbolGlyphs";
import { LINE_ENDPOINT_Y } from "@/lib/diagram/lineConnections";

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
  /** Placement aids are editing UI, never electrical connections. */
  showGuides?: boolean;
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
 * Signal-line endpoints and optional editing guides, ordered by
 * `sort_order`, with an optional top label. When editable, hovering a guide
 * emphasizes it and turns the cursor into a horizontal-move affordance; dragging
 * slides the line (and reflows the lines to its right).
 */
export function LineColumns({
  lines,
  height = LOGICAL_HEIGHT,
  showGuides = false,
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
        const type =
          line.direction === "output"
            ? "output_port"
            : line.direction === "bidirectional"
              ? "bidir_port"
              : "input_port";
        const size = COMPONENT_LIBRARY[type].defaultSize;
        const centerY = LINE_ENDPOINT_Y - size.width / 2;
        const glyph = SYMBOL_GLYPHS[type]({ w: size.width, h: size.height });
        const isHighlighted = highlighted.has(line.id);
        const isHovered = onStartMove != null && hoveredId === line.id;
        return (
          <g key={line.id}>
            {showGuides ? (
              <line
                data-editor-only="true"
                data-testid={`line-guide-${line.id}`}
                x1={x}
                y1={LINE_ENDPOINT_Y}
                x2={x}
                y2={height}
                stroke={color}
                strokeWidth={1}
                strokeDasharray="2 8"
                opacity={isHighlighted || isHovered ? 0.35 : 0.12}
                pointerEvents="none"
              />
            ) : null}
            <g
              data-testid={`line-endpoint-${line.id}`}
              data-direction={line.direction}
              role={onSelectLine ? "button" : "img"}
              aria-label={`${line.name}: ${line.direction === "output" ? "Output" : line.direction === "bidirectional" ? "Bidirectional" : "Input"} line endpoint`}
              tabIndex={onSelectLine ? 0 : undefined}
              style={{ cursor: onSelectLine ? "pointer" : undefined }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSelectLine?.(line.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelectLine?.(line.id);
                }
              }}
            >
              <g
                transform={`translate(${x} ${centerY}) rotate(270)`}
                data-component-type={type}
              >
                {glyph.frame}
              </g>
              <circle
                cx={x}
                cy={LINE_ENDPOINT_Y}
                r={3}
                fill="#1a1d27"
                pointerEvents="none"
              />
            </g>
            {line.show_label ? (
              <text
                x={x + size.height / 2 + 12}
                y={centerY + 4}
                textAnchor="start"
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
