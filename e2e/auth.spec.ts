import { test, expect } from "@playwright/test";

// These run against a stubbed Supabase URL (see playwright.config.ts), so
// `auth.getUser()` resolves to no session — every request is unauthenticated.

test("legacy login URL redirects to the homepage", async ({ page }) => {
  await page.goto("/auth/login");

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", {
      name: /a shared map of your cryogenic wiring/i,
    }),
  ).toBeVisible();
});

test("protected route redirects unauthenticated users to the homepage", async ({
  page,
}) => {
  await page.goto("/fridges");

  await expect(page).toHaveURL(/\/\?next=%2Ffridges/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
