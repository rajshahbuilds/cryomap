import { describe, it, expect } from "vitest";
import {
  addAnnotationCommand,
  deleteAnnotationCommand,
  annotationPatchCommand,
} from "@/lib/diagram/editCommands";
import { annotationsRepo, type Db } from "@/lib/repositories";
import { createSupabaseFake, type SupabaseFake } from "./supabase-fake";
import { makeAnnotation } from "./fixtures";

const asDb = (fake: SupabaseFake) => fake as unknown as Db;
const F = "00000000-0000-4000-8000-000000000001";
const G = "00000000-0000-4000-8000-000000000002";
const SHEET = "00000000-0000-4000-8000-0000000000f1";

describe("annotationsRepo", () => {
  it("lists only a given fridge's annotations", async () => {
    const fake = createSupabaseFake({
      annotations: [
        makeAnnotation({ id: "a1", fridge_id: F }),
        makeAnnotation({ id: "a2", fridge_id: G }),
      ],
    });
    const rows = await annotationsRepo(asDb(fake)).listByFridge(F);
    expect(rows.map((a) => a.id)).toEqual(["a1"]);
  });

  it("creates, updates, and removes a note", async () => {
    const fake = createSupabaseFake();
    const repo = annotationsRepo(asDb(fake));

    const created = await repo.create({
      fridge_id: F,
      sheet_id: SHEET,
      text: "hello",
      x_abs: 10,
      y_abs: 20,
    });
    expect(created.text).toBe("hello");

    await repo.update(created.id, { text: "world", x_abs: 30 });
    let rows = await repo.listByFridge(F);
    expect(rows[0]).toMatchObject({ text: "world", x_abs: 30, y_abs: 20 });

    await repo.remove(created.id);
    rows = await repo.listByFridge(F);
    expect(rows).toHaveLength(0);
  });

  it("removeBySheet / removeByFridge scope their deletes", async () => {
    const fake = createSupabaseFake({
      annotations: [
        makeAnnotation({ id: "a1", fridge_id: F, sheet_id: SHEET }),
        makeAnnotation({ id: "a2", fridge_id: F, sheet_id: "other" }),
        makeAnnotation({ id: "a3", fridge_id: G, sheet_id: SHEET }),
      ],
    });
    const repo = annotationsRepo(asDb(fake));

    // removeBySheet keys on sheet_id alone — deletes a1 and a3 (both on SHEET).
    await repo.removeBySheet(SHEET);
    expect(fake.tables.annotations.map((a) => a.id)).toEqual(["a2"]);

    await repo.removeByFridge(F);
    expect(fake.tables.annotations.map((a) => a.id)).toEqual([]);
  });
});

describe("annotation commands", () => {
  it("addAnnotationCommand creates on redo, removes on undo", async () => {
    const fake = createSupabaseFake();
    const cmd = addAnnotationCommand({
      fridge_id: F,
      sheet_id: SHEET,
      text: "New note",
      x_abs: 100,
      y_abs: 200,
    });

    await cmd.redo(asDb(fake));
    expect(await annotationsRepo(asDb(fake)).listByFridge(F)).toHaveLength(1);
    await cmd.undo(asDb(fake));
    expect(await annotationsRepo(asDb(fake)).listByFridge(F)).toHaveLength(0);
    // redo re-creates (and stays undoable)
    await cmd.redo(asDb(fake));
    expect(await annotationsRepo(asDb(fake)).listByFridge(F)).toHaveLength(1);
  });

  it("deleteAnnotationCommand removes on redo, re-creates on undo", async () => {
    const fake = createSupabaseFake({
      annotations: [makeAnnotation({ id: "a1", fridge_id: F, text: "keep" })],
    });
    const annotation = (await annotationsRepo(asDb(fake)).listByFridge(F))[0];
    const cmd = deleteAnnotationCommand(annotation);

    await cmd.redo(asDb(fake));
    expect(await annotationsRepo(asDb(fake)).listByFridge(F)).toHaveLength(0);
    await cmd.undo(asDb(fake));
    const restored = await annotationsRepo(asDb(fake)).listByFridge(F);
    expect(restored).toHaveLength(1);
    expect(restored[0].text).toBe("keep");
  });

  it("annotationPatchCommand applies text/position and reverses it", async () => {
    const fake = createSupabaseFake({
      annotations: [
        makeAnnotation({
          id: "a1",
          fridge_id: F,
          text: "old",
          x_abs: 5,
          y_abs: 5,
        }),
      ],
    });
    const cmd = annotationPatchCommand(
      "a1",
      { text: "old", x_abs: 5, y_abs: 5 },
      { text: "new", x_abs: 50, y_abs: 60 },
    );

    await cmd.redo(asDb(fake));
    expect(fake.tables.annotations[0]).toMatchObject({
      text: "new",
      x_abs: 50,
      y_abs: 60,
    });
    await cmd.undo(asDb(fake));
    expect(fake.tables.annotations[0]).toMatchObject({
      text: "old",
      x_abs: 5,
      y_abs: 5,
    });
  });
});
