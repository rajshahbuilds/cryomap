import { test, expect } from "@playwright/test";

/**
 * Post-deploy smoke checks against a live deployment (see
 * `playwright.smoke.config.ts`). These exercise only unauthenticated surfaces —
 * that the app is served, the login page renders, and route protection is
 * active — so they need no Google credentials. Full authenticated flows are
 * verified manually per the Phase 1 completion checklist.
 */

test("the deployed app serves the login page with Google sign-in", async ({
  page,
}) => {
  await page.goto("/auth/login");

  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /continue with google/i }),
  ).toBeVisible();
});

test("the deployment gates protected routes behind auth", async ({ page }) => {
  await page.goto("/fridges");

  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(
    page.getByRole("button", { name: /continue with google/i }),
  ).toBeVisible();
});
