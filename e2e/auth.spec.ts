import { test, expect } from "@playwright/test";

// These run against a stubbed Supabase URL (see playwright.config.ts), so
// `auth.getUser()` resolves to no session — every request is unauthenticated.

test("login page offers Google sign-in", async ({ page }) => {
  await page.goto("/auth/login");

  await expect(page.getByRole("heading", { name: "CryoMap" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /sign in with google/i }),
  ).toBeVisible();
});

test("protected route redirects unauthenticated users to login", async ({
  page,
}) => {
  await page.goto("/fridges");

  await expect(page).toHaveURL(/\/auth\/login\?next=%2Ffridges/);
  await expect(
    page.getByRole("button", { name: /sign in with google/i }),
  ).toBeVisible();
});
