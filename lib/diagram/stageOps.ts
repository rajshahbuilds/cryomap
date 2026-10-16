import type { Stage } from "@/lib/types";
import { snap } from "./camera";

/** Smallest a stage band may be dragged. */
export const MIN_STAGE_HEIGHT = 40;

/** The next free `sort_order` for a new stage (one past the current max). */
export function nextStageSortOrder(stages: Stage[]): number {
  return stages.reduce((max, stage) => Math.max(max, stage.sort_order), -1) + 1;
}

export interface StageOrderUpdate {
  id: string;
  sort_order: number;
}

/**
 * Move a stage up/down by swapping `sort_order` with its neighbor. Returns the
 * changed pair, or `[]` at the edge / when not found.
 */
export function moveStage(
  stages: Stage[],
  stageId: string,
  direction: "up" | "down",
): StageOrderUpdate[] {
  const ordered = [...stages].sort((a, b) => a.sort_order - b.sort_order);
  const index = ordered.findIndex((stage) => stage.id === stageId);
  if (index < 0) return [];

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= ordered.length) return [];

  const moving = ordered[index];
  const neighbor = ordered[swapIndex];
  return [
    { id: moving.id, sort_order: neighbor.sort_order },
    { id: neighbor.id, sort_order: moving.sort_order },
  ];
}

/**
 * New height for a band whose top is at `bandTop` when its bottom divider is
 * dragged to `logicalY`. Snapped to the grid and clamped to a minimum.
 */
export function resizeStageHeight(bandTop: number, logicalY: number): number {
  return Math.max(MIN_STAGE_HEIGHT, snap(logicalY - bandTop));
}
