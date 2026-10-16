import type { Component, Line } from "@/lib/types";
import { snap } from "./camera";
import { lineColumnXById } from "./lines";

/** Closest two adjacent line trunks may be dragged. */
export const MIN_LINE_GAP = 60;

/** The next free `sort_order` for a new line (one past the current max). */
export function nextLineSortOrder(lines: Line[]): number {
  return lines.reduce((max, line) => Math.max(max, line.sort_order), -1) + 1;
}

/**
 * New gap (this line's `width_px`) when its trunk is dragged to `logicalX`,
 * given the previous trunk sits at `prevTrunkX`. Snapped to the grid and
 * clamped to a minimum so the line can't get too close to the one before it.
 */
export function resizeLineGap(prevTrunkX: number, logicalX: number): number {
  return Math.max(MIN_LINE_GAP, snap(logicalX - prevTrunkX));
}

export interface LineOrderUpdate {
  id: string;
  sort_order: number;
}

/**
 * Move a line one slot left or right by swapping `sort_order` with its
 * neighbor. Returns the two changed rows, or `[]` if the line is already at the
 * edge (or not found).
 */
export function moveLine(
  lines: Line[],
  lineId: string,
  direction: "left" | "right",
): LineOrderUpdate[] {
  const ordered = [...lines].sort((a, b) => a.sort_order - b.sort_order);
  const index = ordered.findIndex((line) => line.id === lineId);
  if (index < 0) return [];

  const swapIndex = direction === "left" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= ordered.length) return [];

  const moving = ordered[index];
  const neighbor = ordered[swapIndex];
  return [
    { id: moving.id, sort_order: neighbor.sort_order },
    { id: neighbor.id, sort_order: moving.sort_order },
  ];
}

/** A component's `x_abs` move when a line shift drags it along. */
export interface ComponentShift {
  id: string;
  before: number;
  after: number;
}

/**
 * Components that move when a line shift drags them along. We only touch
 * stage-pinned components that don't already track a trunk (`line_id == null`):
 * line-attached ones follow their trunk at render time, and free-floating
 * white-space components keep their absolute position.
 */
function draggable(
  component: Component,
): component is Component & { x_abs: number } {
  return (
    component.line_id == null &&
    !component.free_floating &&
    component.x_abs != null
  );
}

/**
 * Dragging a trunk to `delta` (newWidth − oldWidth) translates that line and
 * every line to its right by the same amount, so every component at or right of
 * the line's old trunk x (`fromX`) — including ones sitting between lines —
 * shifts along with it.
 */
export function componentsShiftedByResize(
  fromX: number,
  delta: number,
  components: Component[],
): ComponentShift[] {
  if (delta === 0) return [];
  const shifts: ComponentShift[] = [];
  for (const component of components) {
    if (!draggable(component) || component.x_abs < fromX) continue;
    shifts.push({
      id: component.id,
      before: component.x_abs,
      after: component.x_abs + delta,
    });
  }
  return shifts;
}

/**
 * Reordering swaps two adjacent lines, so only their trunks move. Each component
 * sitting exactly on a moved trunk slides to that line's new x. Old trunk x's
 * are distinct, so matching by `x_abs` is unambiguous.
 */
export function componentsShiftedByReorder(
  oldLines: Line[],
  newLines: Line[],
  components: Component[],
): ComponentShift[] {
  const oldX = lineColumnXById(oldLines);
  const newX = lineColumnXById(newLines);
  const moved = new Map<number, number>();
  for (const [id, before] of oldX) {
    const after = newX.get(id);
    if (after != null && after !== before) moved.set(before, after);
  }
  const shifts: ComponentShift[] = [];
  for (const component of components) {
    if (!draggable(component)) continue;
    const after = moved.get(component.x_abs);
    if (after != null) {
      shifts.push({ id: component.id, before: component.x_abs, after });
    }
  }
  return shifts;
}
