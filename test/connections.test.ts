import { describe, it, expect } from "vitest";
import { connectionsRepo, type Db } from "@/lib/repositories";
import { writeDiagramState } from "@/lib/diagram/writeDiagram";
import { createSupabaseFake, type SupabaseFake } from "./supabase-fake";
import { makeComponent, makeConnection } from "./fixtures";

const asDb = (fake: SupabaseFake) => fake as unknown as Db;
const F = "00000000-0000-4000-8000-000000000001";

describe("connectionsRepo", () => {
  it("creates, lists by fridge, and removes", async () => {
    const fake = createSupabaseFake();
    const repo = connectionsRepo(asDb(fake));

    const created = await repo.create({
      fridge_id: F,
      from_component_id: "c1",
      from_port_side: "right",
      from_port_index: 0,
      to_component_id: "c2",
      to_port_side: "left",
      to_port_index: 0,
    });
    expect(created.from_component_id).toBe("c1");

    const listed = await repo.listByFridge(F);
    expect(listed).toHaveLength(1);
    expect(listed[0].to_port_side).toBe("left");

    await repo.remove(created.id);
    expect(await repo.listByFridge(F)).toHaveLength(0);
  });
});

describe("writeDiagramState connections", () => {
  it("remaps connection endpoints onto the freshly written components", async () => {
    const fake = createSupabaseFake();
    await writeDiagramState(asDb(fake), F, {
      sheets: [],
      stages: [],
      lines: [],
      customDefs: [],
      components: [
        makeComponent({
          id: "a",
          line_id: null,
          stage_id: null,
          free_floating: true,
        }),
        makeComponent({
          id: "b",
          line_id: null,
          stage_id: null,
          free_floating: true,
        }),
      ],
      connections: [
        makeConnection({ from_component_id: "a", to_component_id: "b" }),
      ],
      annotations: [],
    });

    const newComponentIds = fake.tables.components.map((c) => c.id as string);
    const conns = await connectionsRepo(asDb(fake)).listByFridge(F);
    expect(conns).toHaveLength(1);
    // Endpoints point at the new rows, not the original "a"/"b" ids.
    expect(newComponentIds).toContain(conns[0].from_component_id);
    expect(newComponentIds).toContain(conns[0].to_component_id);
    expect(["a", "b"]).not.toContain(conns[0].from_component_id);
  });

  it("drops a connection whose endpoint component is absent", async () => {
    const fake = createSupabaseFake();
    await writeDiagramState(asDb(fake), F, {
      sheets: [],
      stages: [],
      lines: [],
      customDefs: [],
      components: [
        makeComponent({
          id: "a",
          line_id: null,
          stage_id: null,
          free_floating: true,
        }),
      ],
      connections: [
        makeConnection({ from_component_id: "a", to_component_id: "gone" }),
      ],
      annotations: [],
    });
    expect(await connectionsRepo(asDb(fake)).listByFridge(F)).toHaveLength(0);
  });
});
