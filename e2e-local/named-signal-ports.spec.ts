import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "../lib/types/database";

// Normal local user authentication, including the same SSR cookies as the app.
// Each run owns a new workspace and removes only that workspace on completion.
test("named ports link pages without changing physical wiring", async ({
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
      workspace_name: `Named signal browser test ${randomUUID()}`,
    }),
  )!;
  const fridge = randomUUID(),
    cryo = randomUUID(),
    bench = randomUUID(),
    line = randomUUID(),
    port = randomUUID(),
    bidir = randomUUID();
  try {
    check(
      await db.from("fridges").insert({
        id: fridge,
        name: "Named signal test",
        workspace_id: workspace.id,
      }),
    );
    check(
      await db.from("sheets").insert([
        {
          id: cryo,
          fridge_id: fridge,
          kind: "fridge",
          name: "Cryo",
          sort_order: 0,
        },
        {
          id: bench,
          fridge_id: fridge,
          kind: "room_temp",
          name: "Bench",
          sort_order: 1,
        },
      ]),
    );
    check(
      await db.from("lines").insert({
        id: line,
        fridge_id: fridge,
        sheet_id: cryo,
        name: "Q1 drive",
        sort_order: 0,
      }),
    );
    check(
      await db.from("components").insert([
        {
          id: port,
          fridge_id: fridge,
          sheet_id: bench,
          component_type: "fridge_port",
          linked_line_id: line,
          label: "Old label",
          free_floating: true,
          x_abs: 400,
          y_abs: 160,
        },
        {
          id: bidir,
          fridge_id: fridge,
          sheet_id: bench,
          component_type: "bidir_port",
          label: "Other",
          free_floating: true,
          x_abs: 600,
          y_abs: 160,
        },
      ]),
    );
    await page.goto(`/fridges/${fridge}`);
    await page.getByRole("button", { name: "Check Out to Edit" }).click();
    await expect(
      page.getByRole("button", { name: "Check In", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Fridge Port", exact: true }),
    ).toHaveCount(0);
    for (const name of ["Input", "Output", "Bidirectional"])
      await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
        1,
      );
    await page.getByRole("button", { name: "Bench", exact: true }).click();
    await page.getByTestId(`component-${port}`).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Q1 drive",
    );
    await expect(page.getByLabel("Linked fridge line")).toHaveCount(0);
    await page
      .getByRole("region", { name: "Same signal" })
      .getByRole("button", { name: "Cryo · Input: Q1 drive" })
      .click();
    await expect(page.getByTestId(`line-endpoint-${line}`)).toBeVisible();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Q1 drive",
    );
    await page
      .getByRole("region", { name: "Same signal" })
      .getByRole("button", { name: "Bench · Input: Q1 drive" })
      .click();
    await page.getByLabel("Name", { exact: true }).fill("Q2 drive");
    const savedPort = async () =>
      check(
        await db
          .from("components")
          .select("label,component_type,linked_line_id")
          .eq("id", port)
          .single(),
      );
    await expect.poll(savedPort).toEqual({
      label: "Q2 drive",
      component_type: "input_port",
      linked_line_id: null,
    });
    await expect(
      page.getByText("No other ports with this name."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(savedPort).toMatchObject({ label: "Q1 drive" });
    await expect(
      page.getByRole("region", { name: "Same signal" }).getByRole("button"),
    ).toHaveCount(1);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect.poll(savedPort).toMatchObject({ label: "Q2 drive" });
    await page.getByTestId(`component-${bidir}`).click();
    await page.getByLabel("Name", { exact: true }).fill("Q2 drive");
    await expect(
      page
        .getByRole("region", { name: "Same signal" })
        .getByRole("button", { name: "Bench · Input: Q2 drive" }),
    ).toBeVisible();
    await expect
      .poll(async () =>
        check(
          await db.from("connections").select("id").eq("fridge_id", fridge),
        ),
      )
      .toEqual([]);
    await page.reload();
    await page.getByRole("button", { name: "Bench", exact: true }).click();
    await page.getByTestId(`component-${bidir}`).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Q2 drive",
    );
    await expect(
      page
        .getByRole("region", { name: "Same signal" })
        .getByRole("button", { name: "Bench · Input: Q2 drive" }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("named-signal-ports.png"),
    });
    expect(hydrationErrors).toEqual([]);
  } finally {
    check(await db.from("workspaces").delete().eq("id", workspace.id));
  }
});
