import type { Sheet, SheetKind } from "@/lib/types";
import type { FlowOrientation } from "./componentGeometry";

/**
 * The signal-flow direction of a sheet: a room-temp bench flows left-to-right,
 * a fridge flows top-to-bottom. A fridge with no resolved sheet (a pre-sheets
 * snapshot) is treated as a fridge — the only diagram that existed before.
 */
export function sheetOrientation(sheet: Sheet | null): FlowOrientation {
  return sheet?.kind === "room_temp" ? "horizontal" : "vertical";
}

/** The default name for a new sheet of each kind. */
export const SHEET_KIND_NAME: Record<SheetKind, string> = {
  fridge: "Fridge wiring",
  room_temp: "Room temp wiring",
};

/** The name a brand-new sheet gets, unique among its siblings. */
export function nextSheetName(
  sheets: Sheet[],
  base = SHEET_KIND_NAME.room_temp,
): string {
  const taken = new Set(sheets.map((s) => s.name));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Append position for a new sheet. */
export function nextSheetSortOrder(sheets: Sheet[]): number {
  return sheets.reduce((max, s) => Math.max(max, s.sort_order), -1) + 1;
}

/**
 * Any sheet may be deleted — taking its stages, lines, components, and
 * connections with it — except the last one. A fridge with no sheets has nothing
 * to render and no tab to click, so the editor would strand the user on a blank
 * canvas with no way back.
 */
export function canDeleteSheet(sheet: Sheet, sheets: Sheet[]): boolean {
  return sheets.length > 1 && sheets.some((s) => s.id === sheet.id);
}

/** Sheets in tab order. */
export function orderSheets(sheets: Sheet[]): Sheet[] {
  return [...sheets].sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Which sheet the editor should show. Prefers the requested one, then the first
 * fridge sheet, then the first tab — so a deleted or unknown sheet id degrades
 * to something renderable instead of a blank canvas.
 */
export function resolveActiveSheet(
  sheets: Sheet[],
  requestedId: string | null,
): Sheet | null {
  const ordered = orderSheets(sheets);
  return (
    ordered.find((s) => s.id === requestedId) ??
    ordered.find((s) => s.kind === "fridge") ??
    ordered[0] ??
    null
  );
}

/** Swap two sheets' `sort_order`s to move one left/right in the tab bar. */
export interface SheetOrderUpdate {
  id: string;
  sort_order: number;
}

export function planSheetReorder(
  sheets: Sheet[],
  id: string,
  direction: -1 | 1,
): { before: SheetOrderUpdate[]; after: SheetOrderUpdate[] } | null {
  const ordered = orderSheets(sheets);
  const index = ordered.findIndex((s) => s.id === id);
  const swapIndex = index + direction;
  if (index < 0 || swapIndex < 0 || swapIndex >= ordered.length) return null;

  const a = ordered[index];
  const b = ordered[swapIndex];
  return {
    before: [
      { id: a.id, sort_order: a.sort_order },
      { id: b.id, sort_order: b.sort_order },
    ],
    after: [
      { id: a.id, sort_order: b.sort_order },
      { id: b.id, sort_order: a.sort_order },
    ],
  };
}

/** Default kind for a sheet created from the "+" tab. */
export const NEW_SHEET_KIND: SheetKind = "room_temp";

/** The first fridge-wiring sheet, if the fridge has one. */
export function fridgeSheet(sheets: Sheet[]): Sheet | null {
  return orderSheets(sheets).find((sheet) => sheet.kind === "fridge") ?? null;
}
