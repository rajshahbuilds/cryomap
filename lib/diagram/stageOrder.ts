import type { Stage } from "@/lib/types";
import type { StageOrderUpdate } from "./stageOps";

/**
 * Parse a free-text nominal temperature into Kelvin. Tolerates a leading
 * qualifier (e.g. "~"), an optional metric prefix (m/µ/n), and the "K" unit:
 * "300 K" → 300, "~700 mK" → 0.7, "10 mK" → 0.01. Returns `null` when there is
 * no recognizable temperature (e.g. "device"), so callers can treat those
 * stages as unsortable.
 */
export function parseTemperatureK(
  input: string | null | undefined,
): number | null {
  if (!input) return null;
  const match = input.match(/(-?\d+(?:\.\d+)?)\s*(m|µ|μ|u|n)?\s*k/i);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  if (Number.isNaN(value)) return null;
  const prefix = (match[2] ?? "").toLowerCase();
  const multiplier =
    prefix === "m"
      ? 1e-3
      : prefix === "u" || prefix === "µ" || prefix === "μ"
        ? 1e-6
        : prefix === "n"
          ? 1e-9
          : 1;
  return value * multiplier;
}

/** Sort key in Kelvin; unknown temperatures sort coldest (to the bottom). */
function tempKey(temp: string | null): number {
  return parseTemperatureK(temp) ?? Number.NEGATIVE_INFINITY;
}

/**
 * The index (top = 0) at which a new stage with `nominalTemp` belongs to keep
 * stages ordered hottest-to-coldest: just above the first existing stage that
 * is colder. `ordered` must already be sorted by `sort_order`.
 */
export function stageInsertionIndex(
  ordered: Stage[],
  nominalTemp: string | null,
): number {
  const newKey = tempKey(nominalTemp);
  for (let i = 0; i < ordered.length; i++) {
    if (tempKey(ordered[i].nominal_temp) < newKey) return i;
  }
  return ordered.length;
}

export interface StageInsertionPlan {
  /** `sort_order` to assign the new stage. */
  newSortOrder: number;
  /** `sort_order` updates for existing stages that shift to make room. */
  shifted: StageOrderUpdate[];
}

/**
 * Plan a temperature-ordered insertion. Renumbers the existing stages to
 * contiguous positions with a gap at the insertion index, and returns the new
 * stage's `sort_order` plus the minimal set of existing-stage `sort_order`
 * changes (only those that actually move).
 */
export function planStageInsertion(
  stages: Stage[],
  nominalTemp: string | null,
): StageInsertionPlan {
  const ordered = [...stages].sort((a, b) => a.sort_order - b.sort_order);
  const index = stageInsertionIndex(ordered, nominalTemp);
  const shifted: StageOrderUpdate[] = [];
  ordered.forEach((stage, i) => {
    const next = i < index ? i : i + 1;
    if (stage.sort_order !== next) {
      shifted.push({ id: stage.id, sort_order: next });
    }
  });
  return { newSortOrder: index, shifted };
}
