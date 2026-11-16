import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "../lib/types/database";

// Normal local user authentication, including the same SSR cookies as the app.
// Each run owns a new workspace and removes only that workspace on completion.
test("line I/O ports move and accept wires in both directions", async ({
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
    stage = randomUUID();
  const filter = randomUUID(),
    second = randomUUID();
  try {
    check(
      await db.from("fridges").insert({
        id: fridge,
        name: "Interactive line port test",
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
        name: "DC7.8",
        sort_order: 0,
      }),
    );
    check(
      await db.from("components").insert(
        [filter, second].map((id, i) => ({
          id,
          fridge_id: fridge,
          sheet_id: sheet,
          stage_id: stage,
          component_type: "filter_lp",
          label: i ? "Second filter" : "First filter",
          x_abs: 520 + i * 160,
          y_abs: 190,
        })),
      ),
    );
    await page.goto(`/fridges/${fridge}`);
    await page.getByRole("button", { name: "Check Out to Edit" }).click();
    await expect(
      page.getByRole("button", { name: "Check In", exact: true }),
    ).toBeVisible();
    const endpoint = page.getByTestId(`line-endpoint-${line}`);
    await expect(endpoint).toBeVisible();
    const original = (await endpoint.boundingBox())!;
    const start = {
      x: original.x + original.width / 2,
      y: original.y + original.height / 2,
    };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 80, start.y + 100, { steps: 12 });
    await page.mouse.up();
    await expect
      .poll(
        async () =>
          check(
            await db
              .from("components")
              .select("x_abs")
              .eq("line_endpoint_id", line)
              .maybeSingle(),
          )?.x_abs,
      )
      .toBe(400);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect
      .poll(
        async () =>
          check(
            await db
              .from("components")
              .select("id")
              .eq("line_endpoint_id", line),
          )?.length,
      )
      .toBe(0);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect
      .poll(
        async () =>
          check(
            await db
              .from("components")
              .select("x_abs")
              .eq("line_endpoint_id", line)
              .maybeSingle(),
          )?.x_abs,
      )
      .toBe(400);

    const portPoint = async (id: string) => {
      await page
        .getByTestId(id === line ? `line-endpoint-${line}` : `component-${id}`)
        .hover();
      const box = (await page.getByTestId(`port-${id}-left-0`).boundingBox())!;
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    const draw = async (from: string, to: string) => {
      const target = await portPoint(to);
      const source = await portPoint(from);
      await page.mouse.move(source.x, source.y);
      await page.mouse.down();
      await page.mouse.move(target.x, target.y, { steps: 16 });
      await page.mouse.up();
    };
    await draw(filter, line);
    await expect
      .poll(
        async () =>
          check(
            await db.from("connections").select("id").eq("fridge_id", fridge),
          )?.length,
      )
      .toBe(1);
    await draw(line, second);
    await expect
      .poll(
        async () =>
          check(
            await db.from("connections").select("id").eq("fridge_id", fridge),
          )?.length,
      )
      .toBe(2);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect
      .poll(
        async () =>
          check(
            await db.from("connections").select("id").eq("fridge_id", fridge),
          )?.length,
      )
      .toBe(1);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect
      .poll(
        async () =>
          check(
            await db.from("connections").select("id").eq("fridge_id", fridge),
          )?.length,
      )
      .toBe(2);
    await page.reload();
    await expect(endpoint).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Wire", exact: true }),
    ).toHaveCount(2);
    await endpoint.click();
    await page
      .getByLabel("Direction", { exact: true })
      .selectOption("bidirectional");
    await expect(endpoint).toHaveAttribute(
      "aria-label",
      "DC7.8: Bidirectional line endpoint",
    );
    await expect
      .poll(
        async () =>
          check(
            await db.from("connections").select("id").eq("fridge_id", fridge),
          )?.length,
      )
      .toBe(2);
    await expect(
      page.getByRole("button", { name: "Wire", exact: true }),
    ).toHaveCount(2);
    await page.screenshot({
      path: testInfo.outputPath("interactive-line-ports.png"),
    });
    expect(hydrationErrors).toEqual([]);
  } finally {
    check(await db.from("workspaces").delete().eq("id", workspace.id));
  }
});
