import { describe, it, expect } from "vitest";
import {
  accountRepo,
  fridgesRepo,
  stagesRepo,
  locksRepo,
  versionsRepo,
  workspacesRepo,
  workspaceMembersRepo,
  workspaceInvitesRepo,
  type Db,
} from "@/lib/repositories";
import {
  unwrap,
  unwrapNullable,
  check,
  RepositoryError,
} from "@/lib/repositories/_support";
import { serializeSnapshot } from "@/lib/types";
import { createSupabaseFake, type SupabaseFake } from "./supabase-fake";
import { makeFridge, makeStage } from "./fixtures";

const asDb = (fake: SupabaseFake) => fake as unknown as Db;
const FRIDGE_ID = "00000000-0000-4000-8000-000000000001";

describe("fridgesRepo", () => {
  it("creates a fridge with the given owner", async () => {
    const repo = fridgesRepo(asDb(createSupabaseFake()));
    const created = await repo.create({ name: "DR-1" }, "user-1");
    expect(created.name).toBe("DR-1");
    expect(created.created_by).toBe("user-1");
    expect(created.id).toBeTruthy();
  });

  it("lists newest-first, gets by id, and updates", async () => {
    const fake = createSupabaseFake({
      fridges: [
        makeFridge({
          id: "f1",
          name: "Old",
          updated_at: "2026-01-01T00:00:00Z",
        }),
        makeFridge({
          id: "f2",
          name: "New",
          updated_at: "2026-06-01T00:00:00Z",
        }),
      ],
    });
    const repo = fridgesRepo(asDb(fake));

    const list = await repo.list();
    expect(list.map((f) => f.name)).toEqual(["New", "Old"]);

    expect((await repo.get("f1"))?.name).toBe("Old");
    expect(await repo.get("missing")).toBeNull();

    const updated = await repo.update("f1", { name: "Renamed" });
    expect(updated.name).toBe("Renamed");
  });

  it("lists only fridges in a given workspace, newest-first", async () => {
    const fake = createSupabaseFake({
      fridges: [
        makeFridge({
          id: "f1",
          workspace_id: "ws-1",
          updated_at: "2026-01-01T00:00:00Z",
        }),
        makeFridge({
          id: "f2",
          workspace_id: "ws-1",
          updated_at: "2026-06-01T00:00:00Z",
        }),
        makeFridge({ id: "f3", workspace_id: "ws-2" }),
      ],
    });
    const list = await fridgesRepo(asDb(fake)).listForWorkspace("ws-1");
    expect(list.map((f) => f.id)).toEqual(["f2", "f1"]);
  });

  it("deletes a fridge", async () => {
    const fake = createSupabaseFake({
      fridges: [makeFridge({ id: "f1" }), makeFridge({ id: "f2" })],
    });
    await fridgesRepo(asDb(fake)).delete("f1");
    expect(fake.tables.fridges.map((f) => f.id)).toEqual(["f2"]);
  });
});

describe("stagesRepo", () => {
  it("bulk-inserts and lists by fridge ordered by sort_order", async () => {
    const repo = stagesRepo(asDb(createSupabaseFake()));
    await repo.createMany([
      { fridge_id: FRIDGE_ID, name: "MXC", sort_order: 1 },
      { fridge_id: FRIDGE_ID, name: "300K", sort_order: 0 },
      {
        fridge_id: "00000000-0000-4000-8000-0000000000ff",
        name: "X",
        sort_order: 0,
      },
    ]);

    const stages = await repo.listByFridge(FRIDGE_ID);
    expect(stages.map((s) => s.name)).toEqual(["300K", "MXC"]);
  });
});

describe("locksRepo", () => {
  it("acquires once per fridge (upsert), reads, and releases", async () => {
    const fake = createSupabaseFake();
    const repo = locksRepo(asDb(fake));

    await repo.acquire({ fridge_id: FRIDGE_ID, locked_by: "user-1" });
    await repo.acquire({ fridge_id: FRIDGE_ID, locked_by: "user-2" });

    expect(fake.tables.locks).toHaveLength(1);
    expect((await repo.get(FRIDGE_ID))?.locked_by).toBe("user-2");

    await repo.release(FRIDGE_ID);
    expect(await repo.get(FRIDGE_ID)).toBeNull();
  });
});

describe("versionsRepo", () => {
  it("stores a snapshot and lists newest-first", async () => {
    const repo = versionsRepo(asDb(createSupabaseFake()));
    const snapshot = serializeSnapshot(
      {
        sheets: [],
        stages: [makeStage()],
        lines: [],
        components: [],
        customDefs: [],
        connections: [],
        annotations: [],
      },
      "2026-06-18T12:00:00.000Z",
    );

    const version = await repo.create({
      fridge_id: FRIDGE_ID,
      snapshot,
      commit_message: "first cooldown",
    });

    expect(version.commit_message).toBe("first cooldown");
    expect(version.snapshot).toEqual(snapshot);
    expect(version.snapshot_type).toBe("current");

    const list = await repo.listByFridge(FRIDGE_ID);
    expect(list).toHaveLength(1);
  });
});

const WS_ID = "00000000-0000-4000-8000-0000000000aa";

describe("workspacesRepo", () => {
  it("creates via the create_workspace RPC, gets by id, and updates", async () => {
    const fake = createSupabaseFake(
      {},
      {
        create_workspace: (args, tables) => {
          const ws = {
            id: "ws-1",
            name: args.workspace_name,
            created_by: "user-1",
            created_at: "2026-06-25T00:00:00Z",
            updated_at: "2026-06-25T00:00:00Z",
          };
          (tables.workspaces ??= []).push(ws);
          return { data: ws, error: null };
        },
      },
    );
    const repo = workspacesRepo(asDb(fake));

    const created = await repo.create("Quantum Lab A");
    expect(created.name).toBe("Quantum Lab A");
    expect(created.created_by).toBe("user-1");
    expect(created.id).toBe("ws-1");

    expect((await repo.get("ws-1"))?.name).toBe("Quantum Lab A");
    expect(await repo.get("missing")).toBeNull();

    const renamed = await repo.update("ws-1", { name: "Lab B" });
    expect(renamed.name).toBe("Lab B");
  });

  it("deletes a workspace", async () => {
    const fake = createSupabaseFake({
      workspaces: [
        { id: "ws-1", name: "A" },
        { id: "ws-2", name: "B" },
      ],
    });
    await workspacesRepo(asDb(fake)).delete("ws-1");
    expect(fake.tables.workspaces.map((w) => w.id)).toEqual(["ws-2"]);
  });
});

describe("workspaceMembersRepo", () => {
  it("adds, lists by workspace and by user, updates role, removes", async () => {
    const repo = workspaceMembersRepo(asDb(createSupabaseFake()));

    await repo.add({ workspace_id: WS_ID, user_id: "u1", role: "admin" });
    await repo.add({ workspace_id: WS_ID, user_id: "u2", role: "viewer" });
    await repo.add({ workspace_id: "ws-other", user_id: "u1", role: "editor" });

    expect(
      (await repo.listForWorkspace(WS_ID)).map((m) => m.user_id).sort(),
    ).toEqual(["u1", "u2"]);
    expect(
      (await repo.listForUser("u1")).map((m) => m.workspace_id).sort(),
    ).toEqual([WS_ID, "ws-other"]);

    const updated = await repo.updateRole(WS_ID, "u2", "editor");
    expect(updated.role).toBe("editor");

    await repo.remove(WS_ID, "u2");
    expect((await repo.listForWorkspace(WS_ID)).map((m) => m.user_id)).toEqual([
      "u1",
    ]);
  });
});

describe("workspaceInvitesRepo", () => {
  it("creates, lists for a workspace, and revokes (stamps revoked_at)", async () => {
    const fake = createSupabaseFake();
    const repo = workspaceInvitesRepo(asDb(fake));

    const invite = await repo.create(
      { workspace_id: WS_ID, token: "tok-1", role: "editor" },
      "user-1",
    );
    await repo.create(
      { workspace_id: WS_ID, token: "tok-2", role: "viewer" },
      "user-1",
    );

    expect(invite.role).toBe("editor");
    expect(invite.revoked_at).toBeFalsy();
    expect(
      (await repo.listForWorkspace(WS_ID)).map((i) => i.token).sort(),
    ).toEqual(["tok-1", "tok-2"]);

    await repo.revoke(invite.id, new Date("2026-06-25T00:00:00Z"));
    const revoked = fake.tables.workspace_invites.find(
      (i) => i.id === invite.id,
    );
    expect(revoked?.revoked_at).toBe("2026-06-25T00:00:00.000Z");
  });

  it("redeems a token via the redeem_invite RPC", async () => {
    const fake = createSupabaseFake(
      {},
      {
        redeem_invite: (args) => ({
          data: {
            status: "joined",
            workspace_id: "ws-1",
            workspace_name: `from ${args.invite_token}`,
          },
          error: null,
        }),
      },
    );
    const result = await workspaceInvitesRepo(asDb(fake)).redeem("tok-1");
    expect(result.status).toBe("joined");
    expect(result.workspace_id).toBe("ws-1");
    expect(result.workspace_name).toBe("from tok-1");
  });
});

describe("accountRepo", () => {
  it("deletes via the delete_account RPC, passing confirmed workspaces", async () => {
    const calls: unknown[] = [];
    const fake = createSupabaseFake(
      {},
      {
        delete_account: (args) => {
          calls.push(args);
          return { data: null, error: null };
        },
      },
    );
    await accountRepo(asDb(fake)).delete(["ws-1"]);
    expect(calls).toEqual([{ confirmed_workspace_ids: ["ws-1"] }]);
  });

  it("throws when the RPC refuses", async () => {
    const fake = createSupabaseFake(
      {},
      {
        delete_account: () => ({
          data: null,
          error: { message: "not confirmed" },
        }),
      },
    );
    await expect(accountRepo(asDb(fake)).delete([])).rejects.toThrow(
      RepositoryError,
    );
  });
});

describe("result helpers", () => {
  it("unwrap throws RepositoryError on a Postgrest error", () => {
    expect(() => unwrap({ data: null, error: { message: "boom" } })).toThrow(
      RepositoryError,
    );
  });

  it("unwrapNullable returns null for a not-found row", () => {
    expect(unwrapNullable({ data: null, error: null })).toBeNull();
  });

  it("check throws on error and is silent otherwise", () => {
    expect(() => check({ error: { message: "nope" } })).toThrow(
      RepositoryError,
    );
    expect(check({ error: null })).toBeUndefined();
  });
});
