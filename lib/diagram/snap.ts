import type { Line, Stage } from "@/lib/types";
import type { Point } from "@/lib/diagram/camera";
import type { BuiltInComponentDefinition } from "@/lib/constants/componentLibrary";
import { lineColumnXById } from "./lines";
import { layoutStageBands } from "./stages";

/** The nearest line×stage intersection a placement would snap to. */
export interface SnapTarget {
  line: Line;
  stage: Stage;
  x: number;
  y: number;
}

/** The line whose trunk x is closest to `logicalX`. */
export function nearestLine(logicalX: number, lines: Line[]): Line | null {
  const xById = lineColumnXById(lines);
  let best: Line | null = null;
  let bestDistance = Infinity;
  for (const line of lines) {
    const x = xById.get(line.id);
    if (x == null) continue;
    const distance = Math.abs(x - logicalX);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = line;
    }
  }
  return best;
}

/** The visible stage whose band center is closest to `logicalY`. */
export function nearestStage(
  logicalY: number,
  stages: Stage[],
): { stage: Stage; centerY: number } | null {
  let best: { stage: Stage; centerY: number } | null = null;
  let bestDistance = Infinity;
  for (const band of layoutStageBands(stages)) {
    const centerY = band.y + band.height / 2;
    const distance = Math.abs(centerY - logicalY);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { stage: band.stage, centerY };
    }
  }
  return best;
}

/** Resolve a logical point to the nearest line×stage intersection. */
export function snapToIntersection(
  point: Point,
  lines: Line[],
  stages: Stage[],
): SnapTarget | null {
  const line = nearestLine(point.x, lines);
  const stage = nearestStage(point.y, stages);
  if (!line || !stage) return null;
  return {
    line,
    stage: stage.stage,
    x: lineColumnXById(lines).get(line.id) ?? 0,
    y: stage.centerY,
  };
}

/**
 * Whether a built-in component may be placed on a line, per its
 * `allowedLineTypes`. `null` means "any line type". Any temperature stage is
 * allowed. Custom components have no constraints.
 */
export function isPlacementAllowed(
  def: BuiltInComponentDefinition,
  line: Line,
): boolean {
  if (
    def.allowedLineTypes &&
    (!line.line_type || !def.allowedLineTypes.includes(line.line_type))
  ) {
    return false;
  }
  return true;
}
