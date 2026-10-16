import type { PositionedComponent } from "./assemble";

/**
 * Apply a click to a selection. A plain click selects only the id; an additive
 * (shift) click toggles it within the current set.
 */
export function toggleSelection(
  current: string[],
  id: string,
  additive: boolean,
): string[] {
  if (!additive) return [id];
  return current.includes(id)
    ? current.filter((existing) => existing !== id)
    : [...current, id];
}

export interface SelectionBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Ids of components whose anchor falls within a (logical) drag-box. */
export function componentsInBox(
  positioned: PositionedComponent[],
  box: SelectionBox,
): string[] {
  const minX = Math.min(box.x1, box.x2);
  const maxX = Math.max(box.x1, box.x2);
  const minY = Math.min(box.y1, box.y2);
  const maxY = Math.max(box.y1, box.y2);
  return positioned
    .filter((p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY)
    .map((p) => p.component.id);
}
