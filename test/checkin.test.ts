import { describe, it, expect } from "vitest";
import { checkInFridge } from "@/lib/diagram/checkin";
import { versionsRepo, type Db } from "@/lib/repositories";
import { createSupabaseFake, type SupabaseFake } from "./supabase-fake";
import { makeComponent, makeLine, makeStage } from "./fixtures";

const asDb = (fake: SupabaseFake) => fake as unknown as Db;
const F = "00000000-0000-4000-8000-000000000001";

function seed() {
  return createSupabaseFake({
    stages: [makeStage({ id: "s1", fridge_id: F })],
    lines: [makeLine({ id: "l1", fridge_id: F })],
    components: [makeComponent({ id: "c1", fridge_id: F, line_id: "l1" })],
    locks: [
      {
        fridge_id: F,
        locked_by: "user-1",
        locked_at: "2026-06-22T12:00:00.000Z",
        expires_at: "2026-06-22T13:00:00.000Z",
      },
    ],
  });
}

describe("checkInFridge", () => {
  it("writes a complete version snapshot and releases the lock", async () => {
    const fake = seed();
    await checkInFridge(asDb(fake), {
      fridgeId: F,
      message: "Initial wiring",
      tag: "v1",
      snapshotType: "current",
      authorId: "user-1",
      authorName: "Ada",
    });

    const versions = await versionsRepo(asDb(fake)).listByFridge(F);
    expect(versions).toHaveLength(1);
    const v = versions[0];
    expect(v).toMatchObject({
      commit_message: "Initial wiring",
      tag: "v1",
      snapshot_type: "current",
      author_id: "user-1",
      author_name: "Ada",
    });
    // The snapshot captured the live state.
    expect(v.snapshot.stages.map((s) => s.id)).toEqual(["s1"]);
    expect(v.snapshot.lines.map((l) => l.id)).toEqual(["l1"]);
    expect(v.snapshot.components.map((c) => c.id)).toEqual(["c1"]);

    // Lock is gone → read-only.
    expect(fake.tables.locks).toHaveLength(0);
  });

  it("defaults the snapshot type to 'current'", async () => {
    const fake = seed();
    await checkInFridge(asDb(fake), { fridgeId: F, message: "msg" });
    const [v] = await versionsRepo(asDb(fake)).listByFridge(F);
    expect(v.snapshot_type).toBe("current");
  });
});
