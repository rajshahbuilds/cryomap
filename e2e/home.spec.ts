import { test, expect } from "@playwright/test";

test("root presents the public CryoMap homepage", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", {
      name: /a shared map of your cryogenic wiring/i,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create your workspace" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Explore the code" }),
  ).toHaveCount(0);
});
