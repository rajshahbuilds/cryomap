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

test("demo ports move, wire manually in either direction, edit properties, and undo deletion", async ({
  page,
}) => {
  page.setDefaultTimeout(5000);
  await page.goto("/playground");
  await page.getByRole("button", { name: "+ Add stage" }).click();
  await page.getByRole("button", { name: "+ Add line" }).click();
  const endpoint = page.getByRole("button", {
    name: "Line 1: Input line endpoint",
    exact: true,
  });
  const lineId = (await endpoint.getAttribute("data-testid"))!.replace(
    "line-endpoint-",
    "",
  );
  const point = async (x: number, y: number) =>
    page.locator("svg[data-top-inset]").evaluate(
      (element, point) => {
        const screen = new DOMPoint(point.x, point.y).matrixTransform(
          (element as SVGSVGElement).getScreenCTM()!,
        );
        return { x: screen.x, y: screen.y };
      },
      { x, y },
    );
  const place = async (label: string, x: number, y: number) => {
    await page
      .getByRole("button", { name: label, exact: true })
      .first()
      .click();
    const target = await point(x, y);
    await page.mouse.click(target.x, target.y);
  };
  await place("Low-pass Filter", 320, 130);
  await expect(
    page.getByRole("button", { name: "Wire", exact: true }),
  ).toHaveCount(0);
  const component = page.locator('[data-testid^="component-"]').first();
  const componentId = (await component.getAttribute("data-testid"))!.replace(
    "component-",
    "",
  );
  const portPoint = async (id: string, side = "left") => {
    await page
      .getByTestId(
        id === lineId ? `line-endpoint-${lineId}` : `component-${id}`,
      )
      .locator("[data-component-type]")
      .hover();
    const box = (await page.getByTestId(`port-${id}-${side}-0`).boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const draw = async (from: string, to: string) => {
    const target = await portPoint(to);
    const start = await portPoint(from);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 12 });
    await page.mouse.up();
  };
  await draw(componentId, lineId);
  const wire = page.getByRole("button", { name: "Wire", exact: true });
  await expect(wire).toHaveCount(1);
  await expect(page.getByText("1 components", { exact: true })).toBeVisible();
  // Repeating the same cable backwards does not create a duplicate.
  await draw(lineId, componentId);
  await expect(wire).toHaveCount(1);
  const before = await wire.getAttribute("d");
  const body = await endpoint.locator("[data-component-type]").boundingBox();
  await page.mouse.move(body!.x + body!.width / 2, body!.y + body!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    body!.x + body!.width / 2 + 80,
    body!.y + body!.height / 2 + 80,
    { steps: 12 },
  );
  await page.mouse.up();
  await expect(wire).not.toHaveAttribute("d", before!);
  await endpoint.press("Enter");
  await page.getByLabel("Direction", { exact: true }).selectOption("output");
  await expect(page.getByTestId(`line-endpoint-${lineId}`)).toHaveAttribute(
    "aria-label",
    "Line 1: Output line endpoint",
  );
  await page
    .getByLabel("Direction", { exact: true })
    .selectOption("bidirectional");
  await expect(page.getByTestId(`line-endpoint-${lineId}`)).toHaveAttribute(
    "aria-label",
    "Line 1: Bidirectional line endpoint",
  );
  await expect(wire).toHaveCount(1);
  await wire.press("Enter");
  await page
    .getByLabel("Construction", { exact: true })
    .selectOption("twisted_pair");
  await page.getByRole("button", { name: "Delete wire", exact: true }).click();
  await expect(wire).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await wire.press("Enter");
  await expect(page.getByLabel("Construction", { exact: true })).toHaveValue(
    "twisted_pair",
  );
  await page.keyboard.press("Delete");
  await expect(wire).toHaveCount(0);
  await draw(lineId, componentId);
  await expect(wire).toHaveCount(1);
  await component.press("Enter");
  await page.keyboard.press("Delete");
  await expect(wire).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(wire).toHaveCount(1);
});
