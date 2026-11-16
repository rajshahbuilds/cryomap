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
  await expect(page.getByRole("link", { name: "Try the demo" })).toBeVisible();
  await expect(page.getByText(/no account required/i)).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Create your workspace" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Explore the code" }),
  ).toHaveCount(0);
});

test("homepage advertises a publicly accessible landscape share preview", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const imageUrl = "https://cryomap.vercel.app/share-preview.png";
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    imageUrl,
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
    "content",
    imageUrl,
  );
  const image = await request.get("/share-preview.png");
  expect(image.ok()).toBeTruthy();
  expect(image.headers()["content-type"]).toContain("image/png");
  const png = await image.body();
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
});
