import { test, expect } from "@playwright/test";

test("background music starts with the invitation, pauses and remembers the choice", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const audio = page.locator("audio");
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  await page.getByRole("button", { name: "Відкрити запрошення", exact: true }).click();
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0);
  expect(await audio.evaluate((element: HTMLAudioElement) => element.loop)).toBe(true);
  await page.getByRole("button", { name: "Вимкнути музику", exact: true }).click();
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Увімкнути музику", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Пропустити", exact: true }).click();
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  const resume = page.getByRole("button", { name: "Увімкнути музику", exact: true });
  await resume.focus();
  await page.keyboard.press("Space");
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const box = await page.getByRole("button", { name: "Вимкнути музику", exact: true }).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
});
