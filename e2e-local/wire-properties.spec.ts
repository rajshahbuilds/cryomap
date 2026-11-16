import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "../lib/types/database";

// Normal local user authentication, including the same SSR cookies as the app.
// Each run owns a new workspace and removes only that workspace on completion.
test("wire properties survive edits, undo, component deletion, reload, check-in, and export", async ({
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
    bench = randomUUID(),
    line = randomUUID();
  const stageA = randomUUID(),
    stageB = randomUUID(),
    a = randomUUID(),
    b = randomUUID(),
    source = randomUUID(),
    port = randomUUID(),
    connection = randomUUID();
  try {
    check(
      await db.from("fridges").insert({
        id: fridge,
        name: "Wire browser test",
        workspace_id: workspace.id,
      }),
    );
    check(
      await db.from("sheets").insert([
        {
          id: sheet,
          fridge_id: fridge,
          kind: "fridge",
          name: "Fridge wiring",
          sort_order: 0,
        },
        {
          id: bench,
          fridge_id: fridge,
          kind: "room_temp",
          name: "Bench wiring",
          sort_order: 1,
        },
      ]),
    );
    check(
      await db.from("stages").insert([
        {
          id: stageA,
          fridge_id: fridge,
          sheet_id: sheet,
          name: "4 K",
          sort_order: 0,
          height_px: 180,
        },
        {
          id: stageB,
          fridge_id: fridge,
          sheet_id: sheet,
          name: "MXC",
          sort_order: 1,
          height_px: 180,
        },
      ]),
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
      await db.from("components").insert([
        {
          id: a,
          fridge_id: fridge,
          sheet_id: sheet,
          line_id: line,
          stage_id: stageA,
          free_floating: false,
          component_type: "attenuator",
          label: "Top",
        },
        {
          id: b,
          fridge_id: fridge,
          sheet_id: sheet,
          line_id: line,
          stage_id: stageB,
          free_floating: false,
          component_type: "dut",
          label: "Sample",
        },
        {
          id: source,
          fridge_id: fridge,
          sheet_id: bench,
          free_floating: true,
          x_abs: 240,
          y_abs: 200,
          component_type: "signal_generator",
          label: "Source",
        },
        {
          id: port,
          fridge_id: fridge,
          sheet_id: bench,
          free_floating: true,
          x_abs: 640,
          y_abs: 200,
          component_type: "fridge_port",
          label: "Port",
        },
      ]),
    );
    check(
      await db.from("connections").insert({
        id: connection,
        fridge_id: fridge,
        sheet_id: bench,
        from_component_id: source,
        from_port_side: "right",
        to_component_id: port,
        to_port_side: "left",
      }),
    );
    page.on("dialog", (dialog) => {
      void dialog.accept();
    });
    await page.goto(`/fridges/${fridge}`);
    // A vertical SVG path has zero geometric width; click its actual stroked
    // midpoint rather than asking Playwright to click a zero-width bounding box.
    const midpoint = await page
      .getByRole("button", { name: "Wire", exact: true })
      .evaluate((element) => {
        const path = element as SVGPathElement;
        const point = path.getPointAtLength(path.getTotalLength() / 2);
        const screen = new DOMPoint(point.x, point.y).matrixTransform(
          path.getScreenCTM()!,
        );
        return { x: screen.x, y: screen.y };
      });
    await page.mouse.click(midpoint.x, midpoint.y);
    await expect(
      page.getByLabel("Construction", { exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", {
        name: "Signal: line endpoint connection",
        exact: true,
      })
      .press("Enter");
    await expect(
      page.getByLabel("Construction", { exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByText("Signal I/O port → Top", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Check Out to Edit" }).click();
    await expect(
      page.getByLabel("Construction", { exact: true }),
    ).toBeEnabled();
    const entryDatasheet = "https://example.com/entry-wire.pdf";
    const entryProperties = async () =>
      check(
        await db
          .from("lines")
          .select("entry_wire_properties")
          .eq("id", line)
          .single(),
      )!.entry_wire_properties;
    await page
      .getByLabel("Construction", { exact: true })
      .selectOption("coaxial");
    await expect
      .poll(entryProperties)
      .toMatchObject({ construction: "coaxial" });
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByLabel("Construction", { exact: true })).toHaveValue(
      "unspecified",
    );
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(page.getByLabel("Construction", { exact: true })).toHaveValue(
      "coaxial",
    );
    for (const [name, value] of [
      ["Label", "Entry feed"],
      ["Conductor material", "CuNi"],
      ["Shield material", "copper"],
      ["Length", "0.75"],
      ["Gauge / diameter", "36"],
      ["Conductor count", "1"],
      ["Datasheet URL", entryDatasheet],
      ["Notes", "Warm lead"],
    ]) {
      await page.getByLabel(name, { exact: true }).fill(value);
      await page.getByLabel(name, { exact: true }).press("Tab");
    }
    await expect(
      page.locator("svg text").filter({ hasText: /^Entry feed$/ }),
    ).toHaveCount(0);
    await page.getByLabel("Show label on diagram").check();
    await expect(
      page.locator("svg text").filter({ hasText: /^Entry feed$/ }),
    ).toHaveCount(1);
    await expect.poll(entryProperties).toMatchObject({
      construction: "coaxial",
      label: "Entry feed",
      show_label: true,
      material: "CuNi",
      inner_shield_material: "copper",
      length: { value: 0.75, unit: "m" },
      size: { value: 36, unit: "awg" },
      conductor_count: 1,
      datasheet_url: entryDatasheet,
      notes: "Warm lead",
    });
    await page
      .getByRole("button", { name: "Signal: Input line endpoint", exact: true })
      .click();
    await expect(
      page.getByLabel("Direction", { exact: true }).locator("option"),
    ).toHaveCount(3);
    await page.getByLabel("Direction", { exact: true }).selectOption("output");
    await expect(
      page.getByRole("button", {
        name: "Signal: Output line endpoint",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByLabel("Direction", { exact: true })).toHaveValue(
      "input",
    );
    await page
      .getByLabel("Direction", { exact: true })
      .selectOption("bidirectional");
    await expect(
      page.getByRole("button", {
        name: "Signal: Bidirectional line endpoint",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByLabel("Direction", { exact: true }).selectOption("input");
    await expect(
      page.getByRole("button", {
        name: "Signal: Input line endpoint",
        exact: true,
      }),
    ).toBeVisible();
    await page.locator(`[data-component-id="${b}"]`).click();
    await page
      .getByLabel("Connection above", { exact: true })
      .selectOption("top:0");
    const entryPort = async () =>
      check(
        await db
          .from("components")
          .select("line_entry_port")
          .eq("id", b)
          .single(),
      )!.line_entry_port;
    await expect.poll(entryPort).toEqual({ side: "top", index: 0 });
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(entryPort).toBeNull();
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect.poll(entryPort).toEqual({ side: "top", index: 0 });
    await page
      .getByRole("button", { name: "Wire", exact: true })
      .press("Enter");
    await page
      .getByLabel("Construction", { exact: true })
      .selectOption("twisted_pair");
    await expect(page.getByLabel("Construction", { exact: true })).toHaveValue(
      "twisted_pair",
    );
    await page.getByLabel("Label", { exact: true }).fill("Sensor A");
    await page.getByLabel("Label", { exact: true }).press("Tab");
    await expect(
      page.getByRole("button", { name: "Wire: Sensor A", exact: true }),
    ).toBeAttached();
    await expect(
      page.locator("svg text").filter({ hasText: /^Sensor A$/ }),
    ).toHaveCount(0);
    await page.getByLabel("Show label on diagram").check();
    await expect(
      page.locator("svg text").filter({ hasText: /^Sensor A$/ }),
    ).toHaveCount(1);
    await page.getByLabel("Length", { exact: true }).fill("1.25");
    await page.getByLabel("Length unit").selectOption("m");
    await page.getByLabel("Gauge / diameter", { exact: true }).click();
    await page.getByLabel("Gauge / diameter", { exact: true }).fill("36");
    await page.getByLabel("Conductor count").click();
    await page.getByLabel("Conductor count").fill("2");
    await page.getByLabel("Conductor count").press("Tab");
    await expect(
      page.getByRole("button", { name: "Undo", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByLabel("Conductor count")).toHaveValue("");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(page.getByLabel("Conductor count")).toHaveValue("2");
    const datasheet = "https://example.com/sensor-wire.pdf";
    const coaxDatasheet = "https://example.com/coax.pdf";
    await page.getByLabel("Datasheet URL").fill(datasheet);
    await page.getByLabel("Datasheet URL").press("Tab");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByLabel("Datasheet URL")).toHaveValue("");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(page.getByLabel("Datasheet URL")).toHaveValue(datasheet);
    const properties = async () =>
      check(
        await db
          .from("wire_segment_properties")
          .select("wire_properties")
          .eq("fridge_id", fridge)
          .single(),
      )!.wire_properties;
    await expect.poll(properties).toMatchObject({
      construction: "twisted_pair",
      label: "Sensor A",
      show_label: true,
      length: { value: 1.25, unit: "m" },
      size: { value: 36, unit: "awg" },
      conductor_count: 2,
      datasheet_url: datasheet,
    });
    await page.locator(`[data-component-id="${a}"]`).click();
    await page.keyboard.press("Delete");
    await expect(
      page.getByRole("button", { name: "Wire: Sensor A", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await page
      .getByRole("button", { name: "Wire: Sensor A", exact: true })
      .press("Enter");
    await expect(page.getByLabel("Construction", { exact: true })).toHaveValue(
      "twisted_pair",
    );
    await expect(page.getByLabel("Length", { exact: true })).toHaveValue(
      "1.25",
    );
    await expect(page.getByLabel("Datasheet URL")).toHaveValue(datasheet);
    await page.screenshot({ path: testInfo.outputPath("wire-properties.png") });
    await page.reload();
    await page
      .getByRole("button", { name: "Wire: Sensor A", exact: true })
      .press("Enter");
    await expect(
      page.getByLabel("Gauge / diameter", { exact: true }),
    ).toHaveValue("36");
    await expect(page.getByLabel("Datasheet URL")).toHaveValue(datasheet);
    await page
      .getByRole("button", { name: "Wire: Entry feed", exact: true })
      .press("Enter");
    await expect(page.getByLabel("Construction", { exact: true })).toHaveValue(
      "coaxial",
    );
    await expect(
      page.getByLabel("Shield material", { exact: true }),
    ).toHaveValue("copper");
    await expect(page.getByLabel("Length", { exact: true })).toHaveValue(
      "0.75",
    );
    await expect(page.getByLabel("Datasheet URL", { exact: true })).toHaveValue(
      entryDatasheet,
    );
    await page.screenshot({
      path: testInfo.outputPath("entry-wire-properties.png"),
    });
    await page
      .getByRole("button", { name: "Bench wiring", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Wire", exact: true })
      .press("Enter");
    await page
      .getByLabel("Construction", { exact: true })
      .selectOption("coaxial");
    await expect(page.getByLabel("Shield material")).toBeVisible();
    await page.getByLabel("Datasheet URL").fill(coaxDatasheet);
    await page.getByLabel("Datasheet URL").press("Tab");
    await page.getByLabel("Label", { exact: true }).fill("RF feed");
    await page.getByLabel("Label", { exact: true }).press("Tab");
    await expect
      .poll(
        async () =>
          check(
            await db
              .from("connections")
              .select("wire_properties")
              .eq("id", connection)
              .single(),
          )!.wire_properties,
      )
      .toMatchObject({
        construction: "coaxial",
        label: "RF feed",
        show_label: false,
        datasheet_url: coaxDatasheet,
      });
    await expect(
      page.getByRole("button", { name: "Check In", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Check In", exact: true }).click();
    await page.getByPlaceholder("What changed?").fill("Verify wire properties");
    await page.getByRole("button", { name: "Check in", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Check Out to Edit" }),
    ).toBeVisible();
    const version = check(
      await db
        .from("versions")
        .select("snapshot")
        .eq("fridge_id", fridge)
        .single(),
    )!;
    expect(version.snapshot).toMatchObject({
      lines: [
        {
          direction: "input",
          entry_wire_properties: {
            construction: "coaxial",
            label: "Entry feed",
            datasheet_url: entryDatasheet,
          },
        },
      ],
      components: expect.arrayContaining([
        {
          ...check(
            await db.from("components").select("*").eq("id", b).single(),
          )!,
        },
      ]),
      connections: [
        {
          wire_properties: {
            construction: "coaxial",
            label: "RF feed",
            datasheet_url: coaxDatasheet,
          },
        },
      ],
      wire_segment_properties: [
        {
          wire_properties: {
            construction: "twisted_pair",
            label: "Sensor A",
            datasheet_url: datasheet,
          },
        },
      ],
    });
    await page.locator('summary[aria-label="Export"]').click();
    const downloaded = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "JSON snapshot" }).click();
    const file = await downloaded;
    const exported = JSON.parse(await readFile((await file.path())!, "utf8"));
    expect(exported).toMatchObject({
      lines: [
        {
          entry_wire_properties: {
            construction: "coaxial",
            label: "Entry feed",
            datasheet_url: entryDatasheet,
          },
        },
      ],
      connections: [{ wire_properties: { datasheet_url: coaxDatasheet } }],
      wire_segment_properties: [
        { wire_properties: { label: "Sensor A", datasheet_url: datasheet } },
      ],
    });
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
    expect(hydrationErrors).toEqual([]);
  } finally {
    check(await db.from("workspaces").delete().eq("id", workspace.id));
  }
});
