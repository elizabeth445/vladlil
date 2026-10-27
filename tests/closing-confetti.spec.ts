import { test, expect } from "@playwright/test";

for (const width of [390, 1440]) {
  test(`closing confetti runs on scroll once and rearms on replay at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Пропустити", exact: true }).click();
    const layer = page.locator(".closing-confetti");
    const visiblePieces = () => layer.locator("span").evaluateAll(elements =>
      elements.filter(element => Number(getComputedStyle(element).opacity) > 0.1).length,
    );
    expect(await visiblePieces()).toBe(0);
    await page.locator(".closing-greeting").scrollIntoViewIfNeeded();
    await expect.poll(visiblePieces).toBeGreaterThan(20);
    await expect(layer).toHaveCSS("pointer-events", "none");
    await page.screenshot({ path: `output/playwright/closing-burst-${width}.png` });
    await expect.poll(visiblePieces, { timeout: 7000 }).toBe(0);
    await page.locator("#location").scrollIntoViewIfNeeded();
    await page.locator(".closing-greeting").scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    expect(await visiblePieces()).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.getByRole("button", { name: "Відкрити конверт ще раз", exact: true }).click();
    await page.getByRole("button", { name: "Пропустити", exact: true }).click();
    await page.locator(".closing-greeting").scrollIntoViewIfNeeded();
    await expect.poll(visiblePieces).toBeGreaterThan(20);
  });
}

test("closing confetti respects reduced motion, including switching it during a burst", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Пропустити", exact: true }).click();
  await page.locator(".closing-greeting").scrollIntoViewIfNeeded();
  const layer = page.locator(".closing-confetti");
  await expect(layer).toBeHidden();
  expect(await layer.locator("span").evaluateAll(elements =>
    elements.every(element => getComputedStyle(element).opacity === "0"),
  )).toBe(true);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(() => layer.locator("span").evaluateAll(elements =>
    elements.some(element => Number(getComputedStyle(element).opacity) > 0.1),
  )).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(layer).toBeHidden();
  expect(await layer.locator("span").evaluateAll(elements =>
    elements.every(element => getComputedStyle(element).opacity === "0"),
  )).toBe(true);
});
