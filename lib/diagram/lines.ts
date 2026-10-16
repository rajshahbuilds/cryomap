import type { Line } from "@/lib/types";

/** Default gap between adjacent line trunks, in logical units (DB default). */
export const COLUMN_WIDTH = 120;

/** Left gutter reserved for the stage temperature labels. */
export const LINE_AREA_LEFT = 200;

/**
 * Reference trunk x of the i-th line when every line uses the default gap. Real
 * positions come from {@link layoutLineColumns}, which accounts for each line's
 * `width_px` (its gap to the previous trunk); this stays correct while all gaps
 * are the default and is handy for placement defaults and tests.
 */
export function lineColumnX(index: number): number {
  return LINE_AREA_LEFT + (index + 1) * COLUMN_WIDTH;
}

/** A laid-out line column: the line, its trunk x, and the trunk x before it. */
export interface LineColumn {
  line: Line;
  x: number;
  /** Trunk x of the previous line (or the left gutter for the first line). */
  prevX: number;
}

/**
 * Order lines by `sort_order` and place each trunk one `width_px` past the
 * previous trunk (the first sits `width_px` past the left gutter). Because
 * positions accumulate, dragging one line further from its predecessor reflows
 * every line to its right — and the components/wires that anchor to them.
 */
export function layoutLineColumns(lines: Line[]): LineColumn[] {
  const ordered = [...lines].sort((a, b) => a.sort_order - b.sort_order);
  let prevX = LINE_AREA_LEFT;
  return ordered.map((line) => {
    const x = prevX + line.width_px;
    const column: LineColumn = { line, x, prevX };
    prevX = x;
    return column;
  });
}

/** Trunk center-x keyed by line id, for component placement and snapping. */
export function lineColumnXById(lines: Line[]): Map<string, number> {
  return new Map(
    layoutLineColumns(lines).map((column) => [column.line.id, column.x]),
  );
}
