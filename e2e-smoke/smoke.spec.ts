import { test, expect } from "@playwright/test";

/**
 * Post-deploy smoke checks against a live deployment (see
 * `playwright.smoke.config.ts`). These exercise only unauthenticated surfaces —
 * that the homepage and sign-in render, and route protection is
 * active — so they need no Google credentials. Full authenticated flows are
 * verified manually per the Phase 1 completion checklist.
 */

test("the deployed legacy login URL redirects to the homepage with sign-in", async ({
  page,
}) => {
  await page.goto("/auth/login");

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", {
      name: /a shared map of your cryogenic wiring/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
});

test("the deployment gates protected routes behind auth", async ({ page }) => {
  await page.goto("/fridges");

  await expect(page).toHaveURL(/\/\?next=%2Ffridges$/);
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
});
