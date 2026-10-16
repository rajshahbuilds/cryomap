/**
 * Pure status-bar derivations. The status bar is presentational; these helpers
 * turn the editor's live state (diagram view, versions, lock, camera) into the
 * small bits of text it renders, so they can be unit-tested without React.
 */

import type { DiagramView } from "./assemble";
import type { Version } from "@/lib/types";
import type { LockState } from "@/lib/locks/state";

/** Number of placed components currently on the canvas. */
export function componentCount(view: DiagramView | null): number {
  return view?.positioned.length ?? 0;
}

/** Camera scale (px per logical unit) as a whole-number zoom percentage. */
export function zoomPercent(scale: number): number {
  return Math.round(scale * 100);
}

/** "1 component" / "N components" / "No components" for the status bar. */
export function componentCountLabel(count: number): string {
  if (count === 0) return "No components";
  return `${count} component${count === 1 ? "" : "s"}`;
}

/** Short label for a version: its tag if present, otherwise the snapshot type. */
export function versionLabel(version: Version): string {
  return version.tag?.trim() || version.snapshot_type;
}

export interface LatestVersionSummary {
  label: string;
  time: string;
}

/**
 * Summary of the most recent version (tag/type + clock time), or `null` when
 * the fridge has never been checked in.
 */
export function latestVersionSummary(
  versions: Version[],
): LatestVersionSummary | null {
  const latest = versions[0];
  if (!latest) return null;
  const date = new Date(latest.created_at);
  const time = Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return { label: versionLabel(latest), time };
}

/** One-line lock summary for the status bar. */
export function lockSummary(
  state: LockState,
  holderName: string | null,
  since: string | null,
): string {
  if (state === "LOCKED_BY_ME") return "Checked out by you";
  if (state === "LOCKED_BY_OTHER") {
    const who = holderName ?? "another user";
    return since ? `Locked by ${who} · ${since}` : `Locked by ${who}`;
  }
  return "Available to check out";
}
