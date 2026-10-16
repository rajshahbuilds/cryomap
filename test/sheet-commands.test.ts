import { describe, it, expect } from "vitest";
import {
  addSheetCommand,
  deleteSheetCommand,
  sheetPatchCommand,
} from "@/lib/diagram/editCommands";
import { loadDiagramState } from "@/lib/diagram/load";
import { sheetsRepo, type Db } from "@/lib/repositories";
import { createSupabaseFake, type SupabaseFake } from "./supabase-fake";
import {
  makeComponent,
  makeConnection,
  makeLine,
  makeSheet,
  makeStage,
} from "./fixtures";

const asDb = (fake: SupabaseFake) => fake as unknown as Db;
const F = "00000000-0000-4000-8000-000000000001";
const FRIDGE_SHEET = "00000000-0000-4000-8000-000000000002";
const BENCH = "00000000-0000-4000-8000-000000000003";

const fridgeSheetRow = makeSheet({ id: FRIDGE_SHEET, kind: "fridge" });
const benchSheetRow = makeSheet({
  id: BENCH,
  kind: "room_temp",
  name: "Room temp wiring",
  sort_order: 1,
});

describe("addSheetCommand", () => {
  it("appends a room-temp sheet, and undo removes it", async () => {
    const fake = createSupabaseFake({ sheets: [fridgeSheetRow] });
    const db = asDb(fake);
    const command = addSheetCommand(F, [fridgeSheetRow]);

    await command.redo(db);
    let sheets = await sheetsRepo(db).listByFridge(F);
    expect(sheets).toHaveLength(2);
    expect(sheets[1].kind).toBe("room_temp");
    expect(sheets[1].name).toBe("Room temp wiring");
    expect(sheets[1].sort_order).toBe(1);

    await command.undo(db);
    sheets = await sheetsRepo(db).listByFridge(F);
    expect(sheets.map((s) => s.id)).toEqual([FRIDGE_SHEET]);
  });
});

describe("sheetPatchCommand", () => {
  it("renames and reverses", async () => {
    const fake = createSupabaseFake({ sheets: [benchSheetRow] });
    const db = asDb(fake);
    const command = sheetPatchCommand(
      BENCH,
      { name: "Room temp wiring" },
      { name: "Renamed sheet" },
    );

    await command.redo(db);
    expect((await sheetsRepo(db).listByFridge(F))[0].name).toBe(
      "Renamed sheet",
    );

    await command.undo(db);
    expect((await sheetsRepo(db).listByFridge(F))[0].name).toBe(
      "Room temp wiring",
    );
  });
});

describe("deleteSheetCommand", () => {
  const onBench = [
    makeComponent({ id: "src", fridge_id: F, sheet_id: BENCH }),
    makeComponent({ id: "dst", fridge_id: F, sheet_id: BENCH }),
  ];
  const benchConnection = makeConnection({
    id: "wire",
    fridge_id: F,
    sheet_id: BENCH,
    from_component_id: "src",
    to_component_id: "dst",
  });
  const fridgeStage = makeStage({
    id: "mxc",
    fridge_id: F,
    sheet_id: FRIDGE_SHEET,
  });
  const fridgeLine = makeLine({
    id: "xy",
    fridge_id: F,
    sheet_id: FRIDGE_SHEET,
  });
  const onFridge = makeComponent({
    id: "att",
    fridge_id: F,
    sheet_id: FRIDGE_SHEET,
    stage_id: "mxc",
    line_id: "xy",
  });

  const benchContents = {
    stages: [],
    lines: [],
    components: onBench,
    connections: [benchConnection],
  };
  const fridgeContents = {
    stages: [fridgeStage],
    lines: [fridgeLine],
    components: [onFridge],
    connections: [],
  };

  const seed = () =>
    createSupabaseFake({
      sheets: [fridgeSheetRow, benchSheetRow],
      stages: [fridgeStage],
      lines: [fridgeLine],
      components: [...onBench, onFridge],
      connections: [benchConnection],
    });

  it("deletes the sheet with its components and connections", async () => {
    const fake = seed();
    const db = asDb(fake);

    await deleteSheetCommand(benchSheetRow, benchContents).redo(db);

    const state = await loadDiagramState(db, F);
    expect(state.sheets.map((s) => s.id)).toEqual([FRIDGE_SHEET]);
    // The other sheet's component is untouched.
    expect(state.components.map((c) => c.id)).toEqual(["att"]);
    expect(state.connections).toEqual([]);
    // A room-temp sheet owns no stages or lines, so the fridge sheet keeps its.
    expect(state.stages).toHaveLength(1);
    expect(state.lines).toHaveLength(1);
  });

  it("undo restores the sheet, its components, and the wire between them", async () => {
    const fake = seed();
    const db = asDb(fake);
    const command = deleteSheetCommand(benchSheetRow, benchContents);

    await command.redo(db);
    await command.undo(db);

    const state = await loadDiagramState(db, F);
    expect(state.sheets).toHaveLength(2);

    const restored = state.sheets.find((s) => s.kind === "room_temp")!;
    expect(restored.name).toBe("Room temp wiring");
    expect(restored.sort_order).toBe(1);
    // A fresh id, so anything holding the old one must re-resolve.
    expect(restored.id).not.toBe(BENCH);

    const restoredComponents = state.components.filter(
      (c) => c.sheet_id === restored.id,
    );
    expect(restoredComponents).toHaveLength(2);

    // The connection survives, re-pointed at the components' fresh ids.
    expect(state.connections).toHaveLength(1);
    const wire = state.connections[0];
    expect(wire.sheet_id).toBe(restored.id);
    const ids = restoredComponents.map((c) => c.id);
    expect(ids).toContain(wire.from_component_id);
    expect(ids).toContain(wire.to_component_id);
    expect(wire.from_component_id).not.toBe("src");
  });

  it("deletes a fridge sheet with its stages and lines", async () => {
    const fake = seed();
    const db = asDb(fake);

    await deleteSheetCommand(fridgeSheetRow, fridgeContents).redo(db);

    const state = await loadDiagramState(db, F);
    expect(state.sheets.map((s) => s.id)).toEqual([BENCH]);
    expect(state.stages).toEqual([]);
    expect(state.lines).toEqual([]);
    // The bench sheet's rows survive.
    expect(state.components.map((c) => c.id).sort()).toEqual(["dst", "src"]);
  });

  it("undo re-points a restored component at its fresh stage and line", async () => {
    const fake = seed();
    const db = asDb(fake);
    const command = deleteSheetCommand(fridgeSheetRow, fridgeContents);

    await command.redo(db);
    await command.undo(db);

    const state = await loadDiagramState(db, F);
    const restored = state.sheets.find((s) => s.kind === "fridge")!;
    expect(restored.id).not.toBe(FRIDGE_SHEET);

    const [stage] = state.stages;
    const [line] = state.lines;
    expect(stage.sheet_id).toBe(restored.id);
    expect(line.sheet_id).toBe(restored.id);
    expect(stage.id).not.toBe("mxc");

    // The component follows all three onto their fresh ids — a stale stage_id
    // would leave it unplaceable, and `assembleDiagram` would silently drop it.
    const component = state.components.find((c) => c.sheet_id === restored.id)!;
    expect(component.stage_id).toBe(stage.id);
    expect(component.line_id).toBe(line.id);
  });

  it("drops a connection whose endpoint didn't survive", async () => {
    const fake = seed();
    const db = asDb(fake);
    // Only one endpoint is handed to the command, as if the other component had
    // already been deleted separately.
    const command = deleteSheetCommand(benchSheetRow, {
      ...benchContents,
      components: [onBench[0]],
    });

    await command.redo(db);
    await command.undo(db);

    const state = await loadDiagramState(db, F);
    expect(state.connections).toEqual([]);
  });
});
