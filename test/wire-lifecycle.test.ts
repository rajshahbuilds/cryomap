import { describe, it, expect } from "vitest";
import {
  DEFAULT_WIRE_PROPERTIES,
  componentCreateSchema,
  connectionCreateSchema,
  wirePropertiesSchema,
  wireSegmentEndpoints,
  type WireSegmentProperties,
} from "@/lib/types";
import {
  componentsRepo,
  connectionsRepo,
  wireSegmentPropertiesRepo,
  type Db,
} from "@/lib/repositories";
import { assembleDiagram } from "@/lib/diagram/assemble";
import { loadDiagramState } from "@/lib/diagram/load";
import {
  deleteLineCommand,
  deleteStageCommand,
  deleteSheetCommand,
  addConnectionCommand,
} from "@/lib/diagram/editCommands";
import {
  wirePropertiesCommand,
  type WireReference,
} from "@/lib/diagram/wireProperties";
import { preserveWiresCommand } from "@/lib/diagram/wireLifecycle";
import { recreateComponent } from "@/lib/diagram/componentService";
import { createSupabaseFake } from "./supabase-fake";
import {
  makeSheet,
  makeStage,
  makeLine,
  makeComponent,
  makeConnection,
} from "./fixtures";

function fixture() {
  const sheet = makeSheet(),
    line = makeLine(),
    otherLine = makeLine({ id: crypto.randomUUID(), sort_order: 1 });
  const stages = [
    makeStage(),
    makeStage({ sort_order: 1 }),
    makeStage({ sort_order: 2 }),
  ];
  const a = makeComponent({ line_id: line.id, stage_id: stages[0].id }),
    b = makeComponent({ line_id: line.id, stage_id: stages[2].id });
  const props = wirePropertiesSchema.parse({
    datasheet_url: "https://example.com/wire.pdf",
    construction: "twisted_pair",
    material: "copper",
    label: "A",
    length: { value: 1, unit: "m" },
  });
  const segment: WireSegmentProperties = {
    id: crypto.randomUUID(),
    fridge_id: sheet.fridge_id,
    sheet_id: sheet.id,
    line_id: line.id,
    ...wireSegmentEndpoints(a.id, b.id),
    wire_properties: props,
    created_at: sheet.created_at,
  };
  const connection = makeConnection({
    from_component_id: a.id,
    to_component_id: b.id,
    from_port_side: "left",
    to_port_side: "right",
    wire_properties: props,
  });
  const fake = createSupabaseFake({
    sheets: [sheet],
    lines: [line, otherLine],
    stages,
    components: [a, b],
    connections: [connection],
    wire_segment_properties: [segment],
  });
  return {
    sheet,
    line,
    otherLine,
    stages,
    a,
    b,
    props,
    segment,
    connection,
    fake,
    db: fake as unknown as Db,
  };
}
describe("wire edit lifecycle", () => {
  it("updates the canvas immediately and rolls the first edit back without a phantom row", async () => {
    const f = fixture();
    await wireSegmentPropertiesRepo(f.db).remove(f.segment.id);
    const initial = await loadDiagramState(f.db, f.sheet.fridge_id);
    const command = wirePropertiesCommand(
      { kind: "implicit", ...f.segment },
      DEFAULT_WIRE_PROPERTIES,
      { label: "New lead", construction: "parallel_pair" },
    );
    const immediate = command.optimisticRedo!(initial);
    expect(initial.wireSegmentProperties).toEqual([]);
    expect(immediate.wireSegmentProperties[0].wire_properties).toMatchObject({
      label: "New lead",
      construction: "parallel_pair",
    });
    await command.redo(f.db);
    expect(
      (await wireSegmentPropertiesRepo(f.db).listByFridge(f.sheet.fridge_id))[0]
        .id,
    ).toBe(immediate.wireSegmentProperties[0].id);
    expect(command.optimisticUndo!(immediate).wireSegmentProperties).toEqual(
      [],
    );
    await command.undo(f.db);
    expect(
      await wireSegmentPropertiesRepo(f.db).listByFridge(f.sheet.fridge_id),
    ).toEqual([]);
  });
  it("merges rapid patches against persisted values rather than stale panel values", async () => {
    const f = fixture();
    const ref: WireReference = { kind: "explicit", id: f.connection.id };
    const construction = wirePropertiesCommand(ref, f.props, {
      construction: "coaxial",
    });
    const label = wirePropertiesCommand(ref, f.props, { label: "RF" });
    await construction.redo(f.db);
    await label.redo(f.db);
    expect(
      (await connectionsRepo(f.db).get(f.connection.id)).wire_properties,
    ).toMatchObject({ construction: "coaxial", label: "RF" });
    await label.undo(f.db);
    expect(
      (await connectionsRepo(f.db).get(f.connection.id)).wire_properties,
    ).toMatchObject({ construction: "coaxial", label: "A" });
    await construction.undo(f.db);
    expect(
      (await connectionsRepo(f.db).get(f.connection.id)).wire_properties,
    ).toEqual(f.props);
  });
  it("creates generated metadata on the first edit, undo removes it, redo recreates it", async () => {
    const f = fixture();
    await wireSegmentPropertiesRepo(f.db).remove(f.segment.id);
    const command = wirePropertiesCommand(
      { kind: "implicit", ...f.segment },
      DEFAULT_WIRE_PROPERTIES,
      { material: "CuNi" },
    );
    await command.redo(f.db);
    expect(
      await wireSegmentPropertiesRepo(f.db).listByFridge(f.sheet.fridge_id),
    ).toHaveLength(1);
    await command.undo(f.db);
    expect(
      await wireSegmentPropertiesRepo(f.db).listByFridge(f.sheet.fridge_id),
    ).toEqual([]);
    await command.redo(f.db);
    expect(
      (await wireSegmentPropertiesRepo(f.db).listByFridge(f.sheet.fridge_id))[0]
        .wire_properties.material,
    ).toBe("CuNi");
  });
  it.each(["component", "line", "stage", "sheet"])(
    "restores both wire kinds after deleting and undoing a %s",
    async (kind) => {
      const f = fixture();
      const edit = wirePropertiesCommand(
        { kind: "explicit", id: f.connection.id },
        f.props,
        { label: "Edited" },
      );
      await edit.redo(f.db);
      const deletion =
        kind === "line"
          ? deleteLineCommand(f.line, [f.a, f.b])
          : kind === "stage"
            ? deleteStageCommand(f.stages[0], [f.a])
            : kind === "sheet"
              ? deleteSheetCommand(f.sheet, {
                  stages: f.stages,
                  lines: [f.line, f.otherLine],
                  components: [f.a, f.b],
                  connections: [
                    {
                      ...f.connection,
                      wire_properties: { ...f.props, label: "Edited" },
                    },
                  ],
                })
              : preserveWiresCommand(
                  {
                    redo: (db) => componentsRepo(db).remove(f.a.id),
                    undo: async (db) => {
                      await recreateComponent(db, f.a);
                    },
                  },
                  f.sheet.fridge_id,
                );
      await deletion.redo(f.db);
      expect(
        await connectionsRepo(f.db).listByFridge(f.sheet.fridge_id),
      ).toEqual([]);
      expect(
        await wireSegmentPropertiesRepo(f.db).listByFridge(f.sheet.fridge_id),
      ).toEqual([]);
      await deletion.undo(f.db);
      expect(
        (await connectionsRepo(f.db).get(f.connection.id)).wire_properties
          .label,
      ).toBe("Edited");
      expect(
        (
          await wireSegmentPropertiesRepo(f.db).listByFridge(f.sheet.fridge_id)
        )[0].wire_properties,
      ).toEqual(f.props);
      await edit.undo(f.db);
      expect(
        (await connectionsRepo(f.db).get(f.connection.id)).wire_properties
          .label,
      ).toBe("A");
      await edit.redo(f.db);
      await deletion.redo(f.db);
      await deletion.undo(f.db);
      expect(
        (await connectionsRepo(f.db).get(f.connection.id)).wire_properties
          .label,
      ).toBe("Edited");
    },
  );
  it("undo restores generated properties cleared by moving to another line", async () => {
    const f = fixture();
    const move = preserveWiresCommand(
      {
        redo: async (db) => {
          await componentsRepo(db).update(f.a.id, { line_id: f.otherLine.id });
        },
        undo: async (db) => {
          await componentsRepo(db).update(f.a.id, { line_id: f.line.id });
        },
      },
      f.sheet.fridge_id,
    );
    await move.redo(f.db);
    expect(
      await wireSegmentPropertiesRepo(f.db).listByFridge(f.sheet.fridge_id),
    ).toEqual([]);
    await move.undo(f.db);
    expect(
      (await wireSegmentPropertiesRepo(f.db).listByFridge(f.sheet.fridge_id))[0]
        .wire_properties,
    ).toEqual(f.props);
  });
  it("new segments start unspecified and the original pair keeps its properties", async () => {
    const f = fixture();
    const inserted = await componentsRepo(f.db).create(
      componentCreateSchema.parse({ ...f.a, stage_id: f.stages[1].id }),
    );
    const view = assembleDiagram(
      await loadDiagramState(f.db, f.sheet.fridge_id),
    );
    expect(view.wires).toHaveLength(2);
    expect(
      view.wires.every((w) => w.properties?.construction === "unspecified"),
    ).toBe(true);
    expect(view.explicitWires[0].properties).toEqual(f.props);
    await componentsRepo(f.db).remove(inserted.id);
    expect(
      assembleDiagram(await loadDiagramState(f.db, f.sheet.fridge_id)).wires[0]
        .properties,
    ).toEqual(f.props);
  });
  it("keeps the same explicit connection id on add/undo/redo", async () => {
    const f = fixture();
    const command = addConnectionCommand(
      connectionCreateSchema.parse({
        ...f.connection,
        wire_properties: f.props,
        fridge_id: f.sheet.fridge_id,
      }),
    );
    await command.redo(f.db);
    const created = (
      await connectionsRepo(f.db).listByFridge(f.sheet.fridge_id)
    ).find((c) => c.id !== f.connection.id)!;
    await command.undo(f.db);
    await command.redo(f.db);
    expect(
      (await connectionsRepo(f.db).get(created.id)).wire_properties,
    ).toEqual(f.props);
  });
});
