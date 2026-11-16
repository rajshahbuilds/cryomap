import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "../lib/types/database";

// Normal local user authentication, including the same SSR cookies as the app.
// Each run owns a new workspace and removes only that workspace on completion.
test("manual wire properties survive deletion, undo, reload, check-in, and export", async ({
  page,
  context,
}, testInfo) => {
  const hydrationErrors: string[] = [];
  const recordHydrationError = (message: string) => {
    if (/hydration|server rendered HTML/i.test(message))
      hydrationErrors.push(message);
  };
  page.on("pageerror", (error) => recordHydrationError(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") recordHydrationError(message.text());
  });
  const url = process.env.CRYOMAP_TEST_SUPABASE_URL!;
  if (url !== "http://127.0.0.1:54321")
    throw new Error("Refusing to test against a non-local database.");
  const cookies = new Map<string, string>();
  const db = createServerClient<Database>(
    url,
    process.env.CRYOMAP_TEST_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
        setAll: (values) => {
          for (const { name, value } of values) cookies.set(name, value);
        },
      },
    },
  );
  const check = <
    T extends { data: unknown; error: { message: string } | null },
  >(
    result: T,
  ): T["data"] => {
    if (result.error) throw new Error(result.error.message);
    return result.data;
  };
  check(
    await db.auth.signInWithPassword({
      email: "developer@cryomap.test",
      password: "Cryomap-local-development-2026!",
    }),
  );
  await context.addCookies(
    [...cookies].map(([name, value]) => ({
      name,
      value,
      domain: "localhost",
      path: "/",
      sameSite: "Lax" as const,
    })),
  );
  const workspace = check(
    await db.rpc("create_workspace", {
      workspace_name: `Wire browser test ${randomUUID()}`,
    }),
  )!;
  const fridge = randomUUID(),
    sheet = randomUUID(),
    line = randomUUID(),
    stage = randomUUID(),
    a = randomUUID(),
    b = randomUUID(),
    connection = randomUUID();
  try {
    check(
      await db.from("fridges").insert({
        id: fridge,
        name: "Manual wire test",
        workspace_id: workspace.id,
      }),
    );
    check(
      await db.from("sheets").insert({
        id: sheet,
        fridge_id: fridge,
        kind: "fridge",
        name: "Wiring",
        sort_order: 0,
      }),
    );
    check(
      await db.from("stages").insert({
        id: stage,
        fridge_id: fridge,
        sheet_id: sheet,
        name: "4 K",
        sort_order: 0,
        height_px: 360,
      }),
    );
    check(
      await db.from("lines").insert({
        id: line,
        fridge_id: fridge,
        sheet_id: sheet,
        name: "Signal",
        sort_order: 0,
      }),
    );
    check(
      await db.from("components").insert(
        [a, b].map((id, i) => ({
          id,
          fridge_id: fridge,
          sheet_id: sheet,
          stage_id: stage,
          line_id: line,
          component_type: "filter_lp",
          label: i ? "Bottom" : "Top",
          x_abs: 320,
          y_abs: 90 + i * 180,
        })),
      ),
    );
    // A saved port-to-port cable, never derived from line alignment.
    check(
      await db.from("connections").insert({
        id: connection,
        fridge_id: fridge,
        sheet_id: sheet,
        from_component_id: a,
        from_port_side: "right",
        to_component_id: b,
        to_port_side: "left",
      }),
    );
    await page.goto(`/fridges/${fridge}`);
    const wire = () =>
      page.getByRole("button", {
        name: /^(Wire|Wire: Sensor A)$/,
        exact: true,
      });
    await expect(wire()).toHaveCount(1);
    await wire().press("Enter");
    await expect(
      page.getByLabel("Construction", { exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Delete wire" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Check Out to Edit" }).click();
    await page
      .getByLabel("Construction", { exact: true })
      .selectOption("twisted_pair");
    await page.getByLabel("Label", { exact: true }).fill("Sensor A");
    await page.getByLabel("Label", { exact: true }).press("Tab");
    const properties = async () =>
      check(
        await db
          .from("connections")
          .select("wire_properties")
          .eq("id", connection)
          .single(),
      )!.wire_properties;
    await expect.poll(properties).toMatchObject({
      construction: "twisted_pair",
      label: "Sensor A",
      show_label: false,
    });
    await expect(
      page.locator("svg text").filter({ hasText: /^Sensor A$/ }),
    ).toHaveCount(0);
    await page.getByLabel("Show label on diagram").check();
    await page.getByLabel("Length", { exact: true }).fill("1.25");
    await page.getByLabel("Length unit").selectOption("m");
    await page.getByLabel("Gauge / diameter", { exact: true }).fill("36");
    await page.getByLabel("Conductor count").fill("2");
    await page.getByLabel("Datasheet URL").fill("https://example.com/wire.pdf");
    await page.getByLabel("Datasheet URL").press("Tab");
    await expect.poll(properties).toMatchObject({
      construction: "twisted_pair",
      label: "Sensor A",
      show_label: true,
      length: { value: 1.25, unit: "m" },
      size: { value: 36, unit: "awg" },
      conductor_count: 2,
      datasheet_url: "https://example.com/wire.pdf",
    });
    await expect(
      page.locator("svg text").filter({ hasText: /^Sensor A$/ }),
    ).toHaveCount(1);
    await page.locator(`[data-component-id="${a}"]`).click();
    await page.keyboard.press("Delete");
    await expect(wire()).toHaveCount(0);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await wire().press("Enter");
    await expect(page.getByLabel("Datasheet URL")).toHaveValue(
      "https://example.com/wire.pdf",
    );
    await page
      .getByRole("button", { name: "Delete wire", exact: true })
      .click();
    await expect(wire()).toHaveCount(0);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await wire().press("Enter");
    await expect(page.getByLabel("Length", { exact: true })).toHaveValue(
      "1.25",
    );
    await page.reload();
    await wire().press("Enter");
    await expect(page.getByLabel("Datasheet URL")).toHaveValue(
      "https://example.com/wire.pdf",
    );
    await page.getByRole("button", { name: "Check In", exact: true }).click();
    await page
      .getByPlaceholder("What changed?")
      .fill("Verify manual wire properties");
    await page.getByRole("button", { name: "Check in", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Check Out to Edit" }),
    ).toBeVisible();
    await page.locator('summary[aria-label="Export"]').click();
    const downloaded = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "JSON snapshot" }).click();
    const file = await downloaded;
    const exported = JSON.parse(await readFile((await file.path())!, "utf8"));
    expect(exported.connections).toEqual([
      expect.objectContaining({
        id: connection,
        wire_properties: expect.objectContaining({
          label: "Sensor A",
          construction: "twisted_pair",
          datasheet_url: "https://example.com/wire.pdf",
        }),
      }),
    ]);
    expect(exported.wire_segment_properties).toEqual([]);
    for (const [label, header] of [
      ["PNG image", "89504e470d0a1a0a"],
      ["PDF document", "255044462d"],
    ]) {
      await page.locator('summary[aria-label="Export"]').click();
      const download = page.waitForEvent("download");
      await page.getByRole("menuitem", { name: label }).click();
      const result = await download;
      const bytes = await readFile((await result.path())!);
      expect(bytes.length).toBeGreaterThan(1000);
      expect(bytes.subarray(0, header.length / 2).toString("hex")).toBe(header);
    }
    await page.screenshot({
      path: testInfo.outputPath("manual-wire-properties.png"),
    });
    expect(hydrationErrors).toEqual([]);
  } finally {
    check(await db.from("workspaces").delete().eq("id", workspace.id));
  }
});
