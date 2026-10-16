import { test, expect } from "@playwright/test";

test("root sends unauthenticated visitors to login", async ({ page }) => {
  // `/` redirects to `/fridges`, which the middleware gates behind auth.
  await page.goto("/");
  await expect(page).toHaveURL(/\/auth\/login/);
});
