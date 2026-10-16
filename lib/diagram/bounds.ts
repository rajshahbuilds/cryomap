import type { Size } from "./camera";
import { LINE_AREA_LEFT, layoutLineColumns } from "./lines";
import { stagesHeight } from "./stages";
import type { DiagramView } from "./assemble";

/** Breathing room (logical units) left past the content on the right/bottom. */
export const CONTENT_MARGIN = 160;

/** Floor on the canvas size so a near-empty fridge still has room to work. */
export const MIN_CANVAS_WIDTH = 1200;
export const MIN_CANVAS_HEIGHT = 800;

/** Slack past a component anchor to keep its symbol inside the bounds. */
const COMPONENT_PAD = 80;

type BoundsInput = Pick<DiagramView, "stages" | "lines" | "positioned">;

/**
 * Logical size of the drawable canvas, derived from the content rather than a
 * fixed constant: the rightmost line trunk and the stacked stage height (plus
 * any free-floating components), padded by a margin and floored at a minimum.
 * Recomputed as content is added, so the canvas starts compact and grows.
 */
export function diagramBounds(view: BoundsInput): Size {
  const columns = layoutLineColumns(view.lines);
  let right = columns.reduce((max, c) => Math.max(max, c.x), LINE_AREA_LEFT);
  let bottom = stagesHeight(view.stages);

  for (const placed of view.positioned) {
    right = Math.max(right, placed.x + COMPONENT_PAD);
    bottom = Math.max(bottom, placed.y + COMPONENT_PAD);
  }

  return {
    width: Math.max(MIN_CANVAS_WIDTH, Math.ceil(right + CONTENT_MARGIN)),
    height: Math.max(MIN_CANVAS_HEIGHT, Math.ceil(bottom + CONTENT_MARGIN)),
  };
}
