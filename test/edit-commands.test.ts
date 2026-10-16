import { describe, it, expect } from "vitest";
import {
  addConnectionCommand,
  addLineCommand,
  addStageCommand,
  componentXShiftCommand,
  deleteConnectionCommand,
  deleteLineCommand,
  linePatchCommand,
  sequenceCommand,
  stagePatchCommand,
} from "@/lib/diagram/editCommands";
import {
  linesRepo,
  componentsRepo,
  connectionsRepo,
  stagesRepo,
  type Db,
} from "@/lib/repositories";
import { createSupabaseFake, type SupabaseFake } from "./supabase-fake";
import { makeComponent, makeConnection, makeLine, makeStage } from "./fixtures";

const asDb = (fake: SupabaseFake) => fake as unknown as Db;
const F = "00000000-0000-4000-8000-000000000001";
const SHEET = "00000000-0000-4000-8000-0000000000f1";
const lineName = async (fake: SupabaseFake, id: string) =>
  (await linesRepo(asDb(fake)).listByFridge(F)).find((l) => l.id === id)?.name;

describe("patch commands", () => {
  it("redo applies, undo restores the captured value", async () => {
    const fake = createSupabaseFake({
      lines: [makeLine({ id: "l1", fridge_id: F, name: "Old" })],
    });
    const cmd = linePatchCommand("l1", { name: "Old" }, { name: "New" });

    await cmd.redo(asDb(fake));
    expect(await lineName(fake, "l1")).toBe("New");
    await cmd.undo(asDb(fake));
    expect(await lineName(fake, "l1")).toBe("Old");
    await cmd.redo(asDb(fake));
    expect(await lineName(fake, "l1")).toBe("New");
  });

  it("reverses a stage height resize", async () => {
    const fake = createSupabaseFake({
      stages: [makeStage({ id: "s1", fridge_id: F, height_px: 120 })],
    });
    const cmd = stagePatchCommand("s1", { height_px: 120 }, { height_px: 200 });
    await cmd.redo(asDb(fake));
    expect(fake.tables.stages[0].height_px).toBe(200);
    await cmd.undo(asDb(fake));
    expect(fake.tables.stages[0].height_px).toBe(120);
  });
});

describe("componentXShiftCommand + sequenceCommand", () => {
  const xById = (fake: SupabaseFake) =>
    Object.fromEntries(fake.tables.components.map((c) => [c.id, c.x_abs]));

  it("shifts x_abs on redo and restores it on undo", async () => {
    const fake = createSupabaseFake({
      components: [
        makeComponent({ id: "c1", fridge_id: F, x_abs: 440 }),
        makeComponent({ id: "c2", fridge_id: F, x_abs: 560 }),
      ],
    });
    const cmd = componentXShiftCommand([
      { id: "c1", before: 440, after: 500 },
      { id: "c2", before: 560, after: 620 },
    ]);

    await cmd.redo(asDb(fake));
    expect(xById(fake)).toEqual({ c1: 500, c2: 620 });
    await cmd.undo(asDb(fake));
    expect(xById(fake)).toEqual({ c1: 440, c2: 560 });
  });

  it("applies a line resize and its component shifts as one atomic step", async () => {
    const fake = createSupabaseFake({
      lines: [makeLine({ id: "l1", fridge_id: F, width_px: 120 })],
      components: [makeComponent({ id: "c1", fridge_id: F, x_abs: 320 })],
    });
    const cmd = sequenceCommand(
      linePatchCommand("l1", { width_px: 120 }, { width_px: 180 }),
      componentXShiftCommand([{ id: "c1", before: 320, after: 380 }]),
    );

    await cmd.redo(asDb(fake));
    expect(fake.tables.lines[0].width_px).toBe(180);
    expect(fake.tables.components[0].x_abs).toBe(380);

    await cmd.undo(asDb(fake));
    expect(fake.tables.lines[0].width_px).toBe(120);
    expect(fake.tables.components[0].x_abs).toBe(320);
  });
});

describe("addLineCommand", () => {
  it("creates on redo and removes the created row on undo", async () => {
    const fake = createSupabaseFake();
    const cmd = addLineCommand(F, SHEET, []);

    await cmd.redo(asDb(fake));
    expect(fake.tables.lines).toHaveLength(1);
    await cmd.undo(asDb(fake));
    expect(fake.tables.lines).toHaveLength(0);
    // redo again re-creates (and is itself undoable)
    await cmd.redo(asDb(fake));
    expect(fake.tables.lines).toHaveLength(1);
  });
});

describe("addStageCommand", () => {
  const sortById = async (fake: SupabaseFake) => {
    const rows = await stagesRepo(asDb(fake)).listByFridge(F);
    return Object.fromEntries(rows.map((s) => [s.id, s.sort_order]));
  };

  it("inserts a hotter stage on top and shifts the rest down; undo restores", async () => {
    const fake = createSupabaseFake({
      stages: [
        makeStage({
          id: "300k",
          fridge_id: F,
          nominal_temp: "300 K",
          sort_order: 0,
        }),
        makeStage({
          id: "4k",
          fridge_id: F,
          nominal_temp: "4 K",
          sort_order: 1,
        }),
      ],
    });
    const existing = await stagesRepo(asDb(fake)).listByFridge(F);
    const cmd = addStageCommand(F, SHEET, existing, {
      name: "Bake",
      nominalTemp: "600 K",
      color: null,
    });

    await cmd.redo(asDb(fake));
    let orders = await sortById(fake);
    const created = fake.tables.stages.find((s) => s.name === "Bake")!;
    expect(created.nominal_temp).toBe("600 K");
    expect(created.sort_order).toBe(0); // top
    expect(orders["300k"]).toBe(1);
    expect(orders["4k"]).toBe(2);

    await cmd.undo(asDb(fake));
    expect(fake.tables.stages.some((s) => s.name === "Bake")).toBe(false);
    orders = await sortById(fake);
    expect(orders["300k"]).toBe(0);
    expect(orders["4k"]).toBe(1);
  });
});

describe("addConnectionCommand", () => {
  it("creates a connection on redo and removes it on undo", async () => {
    const fake = createSupabaseFake();
    const cmd = addConnectionCommand({
      fridge_id: F,
      from_component_id: "c1",
      from_port_side: "right",
      to_component_id: "c2",
      to_port_side: "left",
    });

    await cmd.redo(asDb(fake));
    expect(await connectionsRepo(asDb(fake)).listByFridge(F)).toHaveLength(1);
    await cmd.undo(asDb(fake));
    expect(await connectionsRepo(asDb(fake)).listByFridge(F)).toHaveLength(0);
  });

  it("deleteConnectionCommand removes on redo and re-creates on undo", async () => {
    const fake = createSupabaseFake({
      connections: [makeConnection({ id: "x1", fridge_id: F })],
    });
    const connection = (await connectionsRepo(asDb(fake)).listByFridge(F))[0];
    const cmd = deleteConnectionCommand(connection);

    await cmd.redo(asDb(fake));
    expect(await connectionsRepo(asDb(fake)).listByFridge(F)).toHaveLength(0);
    await cmd.undo(asDb(fake));
    expect(await connectionsRepo(asDb(fake)).listByFridge(F)).toHaveLength(1);
  });
});

describe("deleteLineCommand", () => {
  it("deletes line + components, and undo restores them remapped", async () => {
    const fake = createSupabaseFake({
      lines: [makeLine({ id: "l1", fridge_id: F })],
      components: [
        makeComponent({
          id: "c1",
          fridge_id: F,
          line_id: "l1",
          stage_id: "s1",
        }),
      ],
    });
    const line = (await linesRepo(asDb(fake)).listByFridge(F))[0];
    const components = await componentsRepo(asDb(fake)).listByFridge(F);
    const cmd = deleteLineCommand(line, components);

    await cmd.redo(asDb(fake));
    expect(fake.tables.lines).toHaveLength(0);
    expect(fake.tables.components).toHaveLength(0);

    await cmd.undo(asDb(fake));
    expect(fake.tables.lines).toHaveLength(1);
    const restored = await componentsRepo(asDb(fake)).listByFridge(F);
    expect(restored).toHaveLength(1);
    // the restored component points at the re-created line
    expect(restored[0].line_id).toBe(fake.tables.lines[0].id);
    expect(restored[0].stage_id).toBe("s1");
  });
});
