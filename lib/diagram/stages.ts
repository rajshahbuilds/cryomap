import type { Stage } from "@/lib/types";

/** A laid-out stage band: the stage plus its vertical position and height. */
export interface StageBand {
  stage: Stage;
  y: number;
  height: number;
}

/**
 * Lay out the visible stages as vertically stacked bands. Hidden stages are
 * dropped; the rest are ordered by `sort_order` and given cumulative
 * y-offsets from their `height_px` (top band starts at y = 0).
 */
export function layoutStageBands(stages: Stage[]): StageBand[] {
  const visible = stages
    .filter((stage) => !stage.hidden)
    .sort((a, b) => a.sort_order - b.sort_order);

  let y = 0;
  return visible.map((stage) => {
    const band: StageBand = { stage, y, height: stage.height_px };
    y += stage.height_px;
    return band;
  });
}

/** Total stacked height of the visible stage bands. */
export function stagesHeight(stages: Stage[]): number {
  return stages.reduce(
    (total, stage) => (stage.hidden ? total : total + stage.height_px),
    0,
  );
}
