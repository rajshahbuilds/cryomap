import { describe, it, expect } from "vitest";
import {
  canDeleteSheet,
  fridgeSheet,
  nextSheetName,
  nextSheetSortOrder,
  orderSheets,
  planSheetReorder,
  resolveActiveSheet,
  sheetOrientation,
} from "@/lib/diagram/sheetService";
import { makeSheet } from "./fixtures";

const fridge = makeSheet({ id: "f", kind: "fridge", sort_order: 0 });
const bench = makeSheet({
  id: "b",
  kind: "room_temp",
  name: "Room temp wiring",
  sort_order: 1,
});

describe("canDeleteSheet", () => {
  const sheets = [fridge, bench];

  it("allows a fridge sheet — a fridge may hold several", () => {
    expect(canDeleteSheet(fridge, sheets)).toBe(true);
  });

  it("allows a room-temp sheet", () => {
    expect(canDeleteSheet(bench, sheets)).toBe(true);
  });

  it("refuses the last remaining sheet, whatever its kind", () => {
    expect(canDeleteSheet(fridge, [fridge])).toBe(false);
    expect(canDeleteSheet(bench, [bench])).toBe(false);
  });

  it("refuses a sheet that isn't in the list", () => {
    expect(canDeleteSheet(bench, [fridge, makeSheet({ id: "other" })])).toBe(
      false,
    );
  });
});

describe("nextSheetName", () => {
  it("uses the base name when it's free", () => {
    expect(nextSheetName([fridge])).toBe("Room temp wiring");
  });

  it("suffixes to avoid a collision", () => {
    expect(nextSheetName([fridge, bench])).toBe("Room temp wiring 2");
  });

  it("keeps counting past several collisions", () => {
    const two = makeSheet({ id: "b2", name: "Room temp wiring 2" });
    expect(nextSheetName([fridge, bench, two])).toBe("Room temp wiring 3");
  });
});

describe("nextSheetSortOrder", () => {
  it("appends after the last sheet", () => {
    expect(nextSheetSortOrder([fridge, bench])).toBe(2);
  });

  it("starts at 0 for a fridge with none", () => {
    expect(nextSheetSortOrder([])).toBe(0);
  });
});

describe("resolveActiveSheet", () => {
  const sheets = [bench, fridge]; // deliberately out of sort order

  it("prefers the requested sheet", () => {
    expect(resolveActiveSheet(sheets, "b")?.id).toBe("b");
  });

  it("falls back to the fridge sheet for an unknown id", () => {
    // Deleting the active tab, or undoing that delete (which re-creates the
    // sheet under a fresh id), both leave a stale request behind.
    expect(resolveActiveSheet(sheets, "gone")?.id).toBe("f");
  });

  it("falls back to the fridge sheet when nothing is requested", () => {
    expect(resolveActiveSheet(sheets, null)?.id).toBe("f");
  });

  it("falls back to the first tab when there is no fridge sheet", () => {
    expect(resolveActiveSheet([bench], "gone")?.id).toBe("b");
  });

  it("is null for a fridge with no sheets", () => {
    expect(resolveActiveSheet([], null)).toBeNull();
  });
});

describe("orderSheets / fridgeSheet", () => {
  it("sorts by sort_order without mutating the input", () => {
    const input = [bench, fridge];
    expect(orderSheets(input).map((s) => s.id)).toEqual(["f", "b"]);
    expect(input.map((s) => s.id)).toEqual(["b", "f"]);
  });

  it("finds the fridge sheet", () => {
    expect(fridgeSheet([bench, fridge])?.id).toBe("f");
    expect(fridgeSheet([bench])).toBeNull();
  });
});

describe("sheetOrientation", () => {
  it("is horizontal for a room-temp sheet, vertical otherwise", () => {
    expect(sheetOrientation(bench)).toBe("horizontal");
    expect(sheetOrientation(fridge)).toBe("vertical");
    // A pre-sheets snapshot resolves to no sheet; it's fridge wiring.
    expect(sheetOrientation(null)).toBe("vertical");
  });
});

describe("planSheetReorder", () => {
  it("swaps sort_order with the neighbour", () => {
    const plan = planSheetReorder([fridge, bench], "b", -1);
    expect(plan?.after).toEqual([
      { id: "b", sort_order: 0 },
      { id: "f", sort_order: 1 },
    ]);
    expect(plan?.before).toEqual([
      { id: "b", sort_order: 1 },
      { id: "f", sort_order: 0 },
    ]);
  });

  it("returns null at the edges", () => {
    expect(planSheetReorder([fridge, bench], "f", -1)).toBeNull();
    expect(planSheetReorder([fridge, bench], "b", 1)).toBeNull();
  });

  it("returns null for an unknown sheet", () => {
    expect(planSheetReorder([fridge], "nope", 1)).toBeNull();
  });
});
