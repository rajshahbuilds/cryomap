import { describe, it, expect } from "vitest";
import { assembleDiagram } from "@/lib/diagram/assemble";
import {
  lineEndpointComponent,
  materializeLineEndpointsCommand,
} from "@/lib/diagram/lineEndpoints";
import { lineColumnX } from "@/lib/diagram/lines";
import { LINE_ENDPOINT_Y } from "@/lib/diagram/lineConnections";
import {
  addConnectionCommand,
  componentPatchCommand,
  deleteLineCommand,
} from "@/lib/diagram/editCommands";
import { writeDiagramState } from "@/lib/diagram/writeDiagram";
import { loadDiagramState } from "@/lib/diagram/load";
import { parseSnapshot, serializeSnapshot } from "@/lib/types";
import type { Db } from "@/lib/repositories";
import { createSupabaseFake } from "./supabase-fake";
import {
  makeComponent,
  makeConnection,
  makeDiagramState,
  makeLine,
  makeSheet,
  makeStage,
} from "./fixtures";

const line = makeLine();
const endpoint = () => lineEndpointComponent(line, lineColumnX(0));
const stage = makeStage({ height_px: 300 });
const filter = makeComponent({
  component_type: "filter_lp",
  stage_id: stage.id,
  x_abs: 260,
  y_abs: 100,
});
const state = () =>
  makeDiagramState({ lines: [line], stages: [stage], components: [filter] });
const fakeDb = () => {
  const fake = createSupabaseFake({
    components: [],
    connections: [],
    lines: [line],
  });
  return { fake, db: fake as unknown as Db };
};

describe("interactive line ports", () => {
  it.each(["input", "output", "bidirectional"] as const)(
    "registers a real anchor for a legacy %s endpoint",
    (direction) => {
      const view = assembleDiagram({
        ...state(),
        lines: [{ ...line, direction }],
      });
      const anchor = view.portAnchors.find((p) => p.componentId === line.id)!;
      expect(anchor.port).toEqual({ side: "left", index: 0 });
      expect(anchor.point).toEqual({ x: lineColumnX(0), y: LINE_ENDPOINT_Y });
      expect(
        view.positioned.find((p) => p.component.id === line.id)?.component
          .component_type,
      ).toBe(
        direction === "input"
          ? "input_port"
          : direction === "output"
            ? "output_port"
            : "bidir_port",
      );
    },
  );

  it("routes explicit branches from the line port to two off-line filters", () => {
    const second = { ...filter, id: crypto.randomUUID(), x_abs: 400 };
    const connections = [filter, second].map((c) =>
      makeConnection({
        from_component_id: line.id,
        from_port_side: "left",
        to_component_id: c.id,
        to_port_side: "left",
      }),
    );
    const view = assembleDiagram({
      ...state(),
      components: [endpoint(), filter, second],
      connections,
    });
    expect(view.explicitWires).toHaveLength(2);
    expect(view.explicitWires.every((w) => w.from.y === LINE_ENDPOINT_Y)).toBe(
      true,
    );
    expect(view.lineWires).toHaveLength(0);
  });

  it("moves the endpoint independently and recomputes its existing wire route", () => {
    const attached = { ...filter, line_id: line.id };
    const before = assembleDiagram({ ...state(), components: [attached] });
    const moved = { ...endpoint(), x_abs: 500, y_abs: 60 };
    const after = assembleDiagram({
      ...state(),
      components: [attached, moved],
    });
    expect(before.lineWires[0].from).toEqual({
      x: lineColumnX(0),
      y: LINE_ENDPOINT_Y,
    });
    expect(after.lineWires[0].from).toEqual({ x: 500, y: 92 });
    expect(
      after.positioned.find((p) => p.component.id === attached.id)?.x,
    ).toBe(lineColumnX(0));
  });

  it("gives explicit wiring precedence over the generated entry wire", () => {
    const attached = { ...filter, line_id: line.id };
    const connection = makeConnection({
      from_component_id: line.id,
      from_port_side: "left",
      to_component_id: filter.id,
      to_port_side: "left",
    });
    const view = assembleDiagram({
      ...state(),
      components: [attached, endpoint()],
      connections: [connection],
    });
    expect(view.explicitWires).toHaveLength(1);
    expect(view.lineWires).toHaveLength(0);
  });

  it("materializes a port and saves its movement as one reversible edit", async () => {
    const { fake, db } = fakeDb();
    const command = materializeLineEndpointsCommand(
      componentPatchCommand(line.id, { x_abs: lineColumnX(0) }, { x_abs: 600 }),
      [endpoint()],
    );
    await command.redo(db);
    expect(fake.tables.components[0]).toMatchObject({
      id: line.id,
      line_endpoint_id: line.id,
      x_abs: 600,
    });
    await command.undo(db);
    expect(fake.tables.components).toHaveLength(0);
    await command.redo(db);
    expect(fake.tables.components[0].x_abs).toBe(600);
  });

  it("persists a wire from a new endpoint and supports undo/redo", async () => {
    const { fake, db } = fakeDb();
    fake.tables.components.push(filter);
    const command = materializeLineEndpointsCommand(
      addConnectionCommand({
        fridge_id: line.fridge_id!,
        sheet_id: line.sheet_id,
        from_component_id: line.id,
        from_port_side: "left",
        from_port_index: 0,
        to_component_id: filter.id,
        to_port_side: "left",
        to_port_index: 0,
      }),
      [endpoint()],
    );
    await command.redo(db);
    expect(fake.tables.connections).toHaveLength(1);
    await command.undo(db);
    expect(fake.tables.connections).toHaveLength(0);
    expect(fake.tables.components).toHaveLength(1);
    await command.redo(db);
    expect(fake.tables.connections[0].from_component_id).toBe(line.id);
  });

  it("does not recreate or remove a port another queued edit already persisted", async () => {
    const { fake, db } = fakeDb();
    fake.tables.components.push(endpoint());
    const command = materializeLineEndpointsCommand(
      componentPatchCommand(line.id, { x_abs: 320 }, { x_abs: 500 }),
      [endpoint()],
    );
    await command.redo(db);
    await command.undo(db);
    expect(fake.tables.components).toHaveLength(1);
  });

  it("restores the line port and its wires when undoing a line deletion", async () => {
    const { fake, db } = fakeDb();
    const port = endpoint();
    const attached = { ...filter, line_id: line.id };
    fake.tables.components.push(port, attached);
    fake.tables.connections.push(
      makeConnection({
        from_component_id: port.id,
        from_port_side: "left",
        to_component_id: attached.id,
        to_port_side: "left",
      }),
    );
    const command = deleteLineCommand(line, [port, attached]);
    await command.redo(db);
    expect(fake.tables.components).toHaveLength(0);
    expect(fake.tables.connections).toHaveLength(0);
    await command.undo(db);
    expect(
      fake.tables.components.find((c) => c.line_endpoint_id === line.id),
    ).toMatchObject({ id: port.id, line_id: null });
    expect(fake.tables.connections).toHaveLength(1);
  });

  it("preserves endpoint ownership, position and connections across snapshots and duplication", async () => {
    const source = {
      ...state(),
      sheets: [makeSheet({ id: line.sheet_id! })],
      components: [endpoint(), filter],
      connections: [
        makeConnection({
          from_component_id: line.id,
          from_port_side: "left",
          to_component_id: filter.id,
          to_port_side: "left",
        }),
      ],
    };
    const parsed = parseSnapshot(serializeSnapshot(source));
    expect(parsed.components[0].line_endpoint_id).toBe(line.id);
    const { db } = fakeDb();
    const fridgeId = crypto.randomUUID();
    await writeDiagramState(db, fridgeId, source);
    const cloned = await loadDiagramState(db, fridgeId);
    const port = cloned.components.find((c) => c.line_endpoint_id)!;
    expect(port.line_endpoint_id).toBe(cloned.lines[0].id);
    expect(port.id).not.toBe(line.id);
    expect(cloned.connections[0].from_component_id).toBe(port.id);
    expect(assembleDiagram(cloned).explicitWires).toHaveLength(1);
  });
});
