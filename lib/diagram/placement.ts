import type { Component, Line, Stage } from "@/lib/types";
import type { Point, Size } from "./camera";
import { snapPoint } from "./camera";
import { layoutLineColumns } from "./lines";
import { layoutStageBands, type StageBand } from "./stages";

/**
 * Component placement on the canvas. A component is dropped at an
 * absolute grid position; it's valid only inside a stage band it's allowed in
 * or in the no-temperature white space, and never overlapping another
 * component. A component dropped in a band pins to that stage (its vertical
 * position is stored as an offset from the band top, so it follows the band as
 * stages are resized/reordered); a component in white space stores absolute
 * coords.
 *
 * A drop that lands close to a trunk line magnetizes its x onto that trunk and
 * attaches to the line: the component then tracks the trunk
 * horizontally while keeping its band-relative (or absolute) vertical position.
 */

/** How close (logical px) a drop must be to a trunk to attach to that line. */
export const TRUNK_SNAP_DISTANCE = 30;

/** An axis-aligned footprint, centered at (x, y). */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A component's AABB at a center point, accounting for 90°/270° rotation. */
export function componentBox(center: Point, size: Size, rotation: number): Box {
  const turned = rotation === 90 || rotation === 270;
  return {
    x: center.x,
    y: center.y,
    width: turned ? size.height : size.width,
    height: turned ? size.width : size.height,
  };
}

/** Whether two centered AABBs overlap (sharing only an edge doesn't count). */
export function boxesOverlap(a: Box, b: Box): boolean {
  return (
    Math.abs(a.x - b.x) * 2 < a.width + b.width &&
    Math.abs(a.y - b.y) * 2 < a.height + b.height
  );
}

/** The visible stage band whose vertical span contains `y` (null = white space). */
export function bandAtY(bands: StageBand[], y: number): StageBand | null {
  for (const band of bands) {
    if (y >= band.y && y < band.y + band.height) return band;
  }
  return null;
}

/**
 * Where a component lands: pinned to a stage (band-relative y) or free
 * (absolute). Either kind may also attach to a trunk line (`lineId`), in which
 * case `xAbs` is the trunk's x and the component tracks the line horizontally.
 */
export type PlacementTarget =
  | {
      kind: "stage";
      stageId: string;
      lineId: string | null;
      xAbs: number;
      yOffset: number;
    }
  | { kind: "free"; lineId: string | null; xAbs: number; yAbs: number };

/** The position columns a target writes to a component row. */
export interface PositionFields {
  line_id: string | null;
  stage_id: string | null;
  free_floating: boolean;
  x_abs: number;
  y_abs: number;
}

/** Persisted position columns for a placement target. */
export function targetToPosition(target: PlacementTarget): PositionFields {
  if (target.kind === "stage") {
    return {
      line_id: target.lineId,
      stage_id: target.stageId,
      free_floating: false,
      x_abs: target.xAbs,
      y_abs: target.yOffset,
    };
  }
  return {
    line_id: target.lineId,
    // A trunk-attached component is anchored to its line, not free-floating.
    stage_id: null,
    free_floating: target.lineId == null,
    x_abs: target.xAbs,
    y_abs: target.yAbs,
  };
}

export interface ResolvedPlacement {
  /** Absolute, grid-snapped center the ghost is drawn at. */
  x: number;
  y: number;
  /** False when the spot is a disallowed stage or overlaps a component. */
  valid: boolean;
  /** How to persist it (null when invalid). */
  target: PlacementTarget | null;
}

export interface PlacementInput {
  point: Point;
  size: Size;
  rotation: number;
  stages: Stage[];
  /** Lines whose trunks a nearby drop can attach to (omit to disable). */
  lines?: Line[];
  /** Footprints of the other components to avoid overlapping. */
  obstacles: Box[];
}

/** The line id and trunk x nearest to `x`, or null when there are no lines. */
function nearestTrunk(
  lines: Line[],
  x: number,
): { lineId: string; x: number } | null {
  let best: { lineId: string; x: number } | null = null;
  let bestDistance = Infinity;
  for (const column of layoutLineColumns(lines)) {
    const distance = Math.abs(column.x - x);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { lineId: column.line.id, x: column.x };
    }
  }
  return best;
}

/**
 * Resolve a drop point to a placement: snap to the grid, magnetize x onto a
 * nearby trunk (attaching to that line), decide whether it's a stage band
 * (pinned, band-relative y) or white space (free), check it's clear of other
 * components, and return the absolute position plus how to store it. Any stage
 * is allowed — there are no disallowed temperature stages.
 */
export function resolvePlacement(input: PlacementInput): ResolvedPlacement {
  const { point, size, rotation, stages, lines = [], obstacles } = input;
  const snapped = snapPoint(point);
  const band = bandAtY(layoutStageBands(stages), snapped.y);

  // Attach to the nearest trunk when the drop lands within snap range of it;
  // x then comes from the trunk so the component follows the line.
  const trunk = nearestTrunk(lines, snapped.x);
  const onTrunk =
    trunk != null && Math.abs(trunk.x - snapped.x) <= TRUNK_SNAP_DISTANCE;
  const lineId = onTrunk ? trunk.lineId : null;
  const xAbs = onTrunk ? trunk.x : snapped.x;

  const target: PlacementTarget = band
    ? {
        kind: "stage",
        stageId: band.stage.id,
        lineId,
        xAbs,
        yOffset: snapped.y - band.y,
      }
    : { kind: "free", lineId, xAbs, yAbs: snapped.y };

  const box = componentBox({ x: xAbs, y: snapped.y }, size, rotation);
  const valid = !obstacles.some((o) => boxesOverlap(box, o));

  return { x: xAbs, y: snapped.y, valid, target: valid ? target : null };
}

/** Extract a component's current position columns (for undo). */
export function positionFieldsOf(component: Component): {
  line_id: string | null;
  stage_id: string | null;
  free_floating: boolean;
  x_abs: number | null;
  y_abs: number | null;
} {
  return {
    line_id: component.line_id,
    stage_id: component.stage_id,
    free_floating: component.free_floating,
    x_abs: component.x_abs,
    y_abs: component.y_abs,
  };
}
