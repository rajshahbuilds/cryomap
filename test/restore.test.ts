import { describe, it, expect } from "vitest";
import { restoreVersion, versionLabel } from "@/lib/diagram/restore";
import { checkInFridge } from "@/lib/diagram/checkin";
import { assembleDiagram } from "@/lib/diagram/assemble";
import { loadDiagramState } from "@/lib/diagram/load";
import { snapshotToState } from "@/lib/types";
import { versionsRepo, type Db } from "@/lib/repositories";
import { createSupabaseFake, type SupabaseFake } from "./supabase-fake";
import { makeComponent, makeLine, makeStage } from "./fixtures";

const asDb = (fake: SupabaseFake) => fake as unknown as Db;
const F = "00000000-0000-4000-8000-000000000001";

describe("snapshot → render-state mapping", () => {
  it("assembles a snapshot into a positioned, wired view", async () => {
    const fake = createSupabaseFake({
      stages: [makeStage({ id: "s1", fridge_id: F, sort_order: 0 })],
      lines: [makeLine({ id: "l1", fridge_id: F, sort_order: 0 })],
      components: [
        makeComponent({
          id: "c1",
          fridge_id: F,
          line_id: "l1",
          stage_id: "s1",
        }),
      ],
      locks: [
        {
          fridge_id: F,
          locked_by: "u",
          locked_at: "2026-06-22T12:00:00Z",
          expires_at: "2026-06-22T13:00:00Z",
        },
      ],
    });
    await checkInFridge(asDb(fake), { fridgeId: F, message: "v1" });

    const [version] = await versionsRepo(asDb(fake)).listByFridge(F);
    const view = assembleDiagram(snapshotToState(version.snapshot));
    expect(view.stages.map((s) => s.id)).toEqual(["s1"]);
    expect(view.positioned).toHaveLength(1);
  });
});

describe("restoreVersion", () => {
  it("replaces live tables from the snapshot and logs a new version", async () => {
    // Seed v1 with one component, snapshot it, then mutate the live state.
    const fake = createSupabaseFake({
      stages: [makeStage({ id: "s1", fridge_id: F })],
      lines: [makeLine({ id: "l1", fridge_id: F })],
      components: [
        makeComponent({
          id: "c1",
          fridge_id: F,
          line_id: "l1",
          stage_id: "s1",
        }),
      ],
      locks: [
        {
          fridge_id: F,
          locked_by: "u",
          locked_at: "2026-06-22T12:00:00Z",
          expires_at: "2026-06-22T13:00:00Z",
        },
      ],
    });
    await checkInFridge(asDb(fake), { fridgeId: F, message: "v1", tag: "v1" });
    const [v1] = await versionsRepo(asDb(fake)).listByFridge(F);

    // Diverge: add a second component to the live tables.
    fake.tables.components.push(
      makeComponent({ id: "c2", fridge_id: F, line_id: "l1", stage_id: "s1" }),
    );
    expect(fake.tables.components).toHaveLength(2);

    await restoreVersion(asDb(fake), F, v1, { authorName: "Ada" });

    // Live state matches the snapshot (one component again, fresh ids).
    const state = await loadDiagramState(asDb(fake), F);
    expect(state.stages).toHaveLength(1);
    expect(state.lines).toHaveLength(1);
    expect(state.components).toHaveLength(1);

    // A "Restored from v1" version was logged (originals kept).
    const versions = await versionsRepo(asDb(fake)).listByFridge(F);
    expect(versions.some((v) => v.commit_message === "Restored from v1")).toBe(
      true,
    );
  });
});

describe("restoreVersion of a pre-sheets snapshot", () => {
  it("synthesizes the fridge sheet and lands every row on it", async () => {
    const fake = createSupabaseFake({
      stages: [makeStage({ id: "s1", fridge_id: F })],
      lines: [makeLine({ id: "l1", fridge_id: F })],
      components: [
        makeComponent({
          id: "c1",
          fridge_id: F,
          line_id: "l1",
          stage_id: "s1",
        }),
      ],
      locks: [
        {
          fridge_id: F,
          locked_by: "u",
          locked_at: "2026-06-22T12:00:00Z",
          expires_at: "2026-06-22T13:00:00Z",
        },
      ],
    });
    await checkInFridge(asDb(fake), { fridgeId: F, message: "v1", tag: "old" });
    const [version] = await versionsRepo(asDb(fake)).listByFridge(F);

    // Rewrite the stored snapshot into its pre-sheets shape: no `sheets` key,
    // and `sheet_id` absent from every row — exactly what a version captured
    // before this migration looks like.
    const legacy = JSON.parse(JSON.stringify(version.snapshot));
    delete legacy.sheets;
    for (const row of [...legacy.components, ...legacy.connections]) {
      delete row.sheet_id;
    }
    const legacyVersion = { ...version, snapshot: legacy };

    await restoreVersion(asDb(fake), F, legacyVersion);

    const state = await loadDiagramState(asDb(fake), F);
    expect(state.sheets).toHaveLength(1);
    expect(state.sheets[0].kind).toBe("fridge");
    expect(state.sheets[0].name).toBe("Fridge wiring");

    // Every restored row points at that synthesized sheet — not left null.
    expect(state.components).toHaveLength(1);
    expect(state.components[0].sheet_id).toBe(state.sheets[0].id);

    // And it renders, rather than resolving to a blank canvas.
    const view = assembleDiagram(state);
    expect(view.sheet?.id).toBe(state.sheets[0].id);
    expect(view.positioned).toHaveLength(1);
  });
});

describe("versionLabel", () => {
  it("prefers the tag, else a timestamp", () => {
    expect(
      versionLabel({ tag: "v2", created_at: "2026-06-22T00:00:00Z" } as never),
    ).toBe("v2");
    expect(
      versionLabel({ tag: null, created_at: "2026-06-22T00:00:00Z" } as never),
    ).not.toBe("");
  });
});
