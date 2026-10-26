import { test, expect } from "@playwright/test";

test("playground is public and starts as a temporary empty editor", async ({
  page,
}) => {
  await page.goto("/playground");

  await expect(page).toHaveURL(/\/playground$/);
  await expect(page.getByText("Live demo")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Sign in to save" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "+ Add stage" })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Add line" })).toBeVisible();
  await expect(page.getByText("0 components")).toBeVisible();

  await page.getByRole("button", { name: "+ Add stage" }).click();
  await page.getByRole("button", { name: "+ Add line" }).click();

  await expect(page.getByRole("textbox", { name: "Stage name" })).toHaveValue(
    "50 K",
  );
  await expect(page.getByRole("textbox", { name: "Line name" })).toHaveValue(
    "Line 1",
  );
});
