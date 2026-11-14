import { describe, it, expect } from "vitest";
import {
  DEFAULT_WIRE_PROPERTIES,
  wirePropertiesSchema,
  wireSegmentEndpoints,
  serializeSnapshot,
  parseSnapshot,
  snapshotToState,
  type WireSegmentProperties,
} from "@/lib/types";
import {
  connectionsRepo,
  wireSegmentPropertiesRepo,
  versionsRepo,
  type Db,
} from "@/lib/repositories";
import { loadDiagramState } from "@/lib/diagram/load";
import { writeDiagramState } from "@/lib/diagram/writeDiagram";
import { restoreVersion } from "@/lib/diagram/restore";
import { createSupabaseFake, type SupabaseFake } from "./supabase-fake";
import {
  makeComponent,
  makeConnection,
  makeDiagramState,
  makeLine,
  makeSheet,
} from "./fixtures";

const asDb = (fake: SupabaseFake) => fake as unknown as Db;
const sheet = makeSheet();
const line = makeLine();
const a = makeComponent({ line_id: line.id });
const b = makeComponent({ line_id: line.id });
const properties = wirePropertiesSchema.parse({
  construction: "twisted_pair",
  label: "Sensor A",
  material: "phosphor bronze",
  datasheet_url: "https://example.com/sensor-wire.pdf",
  length: { value: 1.2, unit: "m" },
  size: { value: 36, unit: "awg" },
  conductor_count: 2,
});
const segment: WireSegmentProperties = {
  id: crypto.randomUUID(),
  fridge_id: sheet.fridge_id,
  sheet_id: sheet.id,
  line_id: line.id,
  ...wireSegmentEndpoints(a.id, b.id),
  wire_properties: properties,
  created_at: sheet.created_at,
};
const connection = makeConnection({
  from_component_id: a.id,
  to_component_id: b.id,
  wire_properties: properties,
});
const state = () =>
  makeDiagramState({
    sheets: [sheet],
    lines: [line],
    components: [a, b],
    connections: [connection],
    wireSegmentProperties: [segment],
  });

describe("wire properties", () => {
  it("defaults old wires to unspecified with labels hidden", () => {
    expect(wirePropertiesSchema.parse({})).toEqual(DEFAULT_WIRE_PROPERTIES);
    expect(DEFAULT_WIRE_PROPERTIES.show_label).toBe(false);
    expect(DEFAULT_WIRE_PROPERTIES.datasheet_url).toBeNull();
    const legacy = JSON.parse(JSON.stringify(serializeSnapshot(state())));
    delete legacy.wire_segment_properties;
    delete legacy.connections[0].wire_properties;
    for (const restored of [
      snapshotToState(legacy),
      snapshotToState(parseSnapshot(legacy)),
    ]) {
      expect(restored.wireSegmentProperties).toEqual([]);
      expect(restored.connections[0].wire_properties).toEqual(
        DEFAULT_WIRE_PROPERTIES,
      );
    }
  });
  it.each([
    { construction: "twisted_quad" },
    { show_label: "yes" },
    { length: { value: 0, unit: "m" } },
    { length: { value: 2, unit: "ft" } },
    { size: { value: 1.5, unit: "awg" } },
    { size: { value: -4, unit: "awg" } },
    { size: { value: 0, unit: "mm" } },
    { conductor_count: 0 },
    { conductor_count: 2.5 },
    { conductor_count: 2147483648 },
    { length: { value: Infinity, unit: "m" } },
    { material: 4 },
    { datasheet_url: "not a URL" },
    { datasheet_url: 123 },
    { typo: true },
    { length: { value: 2, unit: "m", other: true } },
  ])("rejects malformed attributes: %j", (input) => {
    expect(wirePropertiesSchema.safeParse(input).success).toBe(false);
  });
  it.each([-3, -2, -1, 0, 36])(
    "accepts AWG %s, including the /0 encodings",
    (value) => {
      expect(
        wirePropertiesSchema.parse({ size: { value, unit: "awg" } }).size
          ?.value,
      ).toBe(value);
    },
  );
  it("defaults existing wire payloads without a datasheet to null", () => {
    const legacy = JSON.parse(JSON.stringify(serializeSnapshot(state())));
    delete legacy.connections[0].wire_properties.datasheet_url;
    delete legacy.wire_segment_properties[0].wire_properties.datasheet_url;
    const restored = snapshotToState(parseSnapshot(legacy));
    expect(restored.connections[0].wire_properties.datasheet_url).toBeNull();
    expect(
      restored.wireSegmentProperties[0].wire_properties.datasheet_url,
    ).toBeNull();
    expect(restored.connections[0].wire_properties.label).toBe("Sensor A");
  });
  it("round-trips both wire kinds through JSON snapshots", () => {
    const restored = snapshotToState(
      parseSnapshot(JSON.parse(JSON.stringify(serializeSnapshot(state())))),
    );
    expect(restored).toEqual(state());
  });
  it("loads only the requested fridge and normalizes missing defaults", async () => {
    const fake = createSupabaseFake({
      connections: [{ ...connection, wire_properties: {} }],
      wire_segment_properties: [
        segment,
        { ...segment, id: crypto.randomUUID(), fridge_id: crypto.randomUUID() },
      ],
    });
    const loaded = await loadDiagramState(asDb(fake), sheet.fridge_id);
    expect(loaded.wireSegmentProperties).toEqual([segment]);
    expect(loaded.connections[0].wire_properties).toEqual(
      DEFAULT_WIRE_PROPERTIES,
    );
  });
  it("updates explicit and generated wire attributes through repositories", async () => {
    const fake = createSupabaseFake({ connections: [connection] });
    const db = asDb(fake);
    const repo = wireSegmentPropertiesRepo(db);
    const created = await repo.create({
      ...segment,
      from_component_id: segment.to_component_id,
      to_component_id: segment.from_component_id,
    });
    expect(created.from_component_id < created.to_component_id).toBe(true);
    expect(
      (
        await repo.update(created.id, {
          wire_properties: { ...properties, show_label: true },
        })
      ).wire_properties.show_label,
    ).toBe(true);
    expect(
      (
        await connectionsRepo(db).update(connection.id, {
          wire_properties: DEFAULT_WIRE_PROPERTIES,
        })
      ).wire_properties,
    ).toEqual(DEFAULT_WIRE_PROPERTIES);
    await repo.remove(created.id);
    expect(await repo.listByFridge(sheet.fridge_id)).toEqual([]);
  });
  it("duplicates attributes while remapping every segment reference", async () => {
    const fake = createSupabaseFake();
    const target = crypto.randomUUID();
    await writeDiagramState(asDb(fake), target, state());
    const loaded = await loadDiagramState(asDb(fake), target);
    expect(loaded.connections[0].wire_properties).toEqual(properties);
    const fresh = loaded.wireSegmentProperties[0];
    expect(fresh.wire_properties).toEqual(properties);
    expect(fresh.fridge_id).toBe(target);
    expect(fresh.sheet_id).toBe(loaded.sheets[0].id);
    expect(fresh.line_id).toBe(loaded.lines[0].id);
    expect(fresh.from_component_id < fresh.to_component_id).toBe(true);
    expect(new Set([fresh.from_component_id, fresh.to_component_id])).toEqual(
      new Set(loaded.components.map((c) => c.id)),
    );
    expect([a.id, b.id]).not.toContain(fresh.from_component_id);
  });
  it("restores wire attributes and removes live rows from the replaced diagram", async () => {
    const fake = createSupabaseFake({
      wire_segment_properties: [{ ...segment, id: "discard-me" }],
    });
    const db = asDb(fake);
    const version = await versionsRepo(db).create({
      fridge_id: sheet.fridge_id,
      snapshot: serializeSnapshot(state()),
      commit_message: "with wires",
    });
    await restoreVersion(db, sheet.fridge_id, version);
    const loaded = await loadDiagramState(db, sheet.fridge_id);
    expect(loaded.wireSegmentProperties).toHaveLength(1);
    expect(loaded.wireSegmentProperties[0].id).not.toBe("discard-me");
    expect(loaded.wireSegmentProperties[0].wire_properties).toEqual(properties);
    expect(loaded.connections[0].wire_properties).toEqual(properties);
  });
});
