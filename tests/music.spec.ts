import { test, expect } from "@playwright/test";

test("music starts with opening the invitation, pauses and can resume while browsing", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const audio = page.locator("audio");
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  await page.locator(".opening-caption").click();
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  await page.getByRole("button", { name: "Відкрити запрошення", exact: true }).click();
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0);
  await expect(page.getByRole("dialog")).toBeVisible();
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
    expect(box!.x).toBeGreaterThan(width / 2);
    expect(width - box!.x - box!.width).toBe(20);
    const toolbar = page.locator("[data-agentation-toolbar]");
    if (await toolbar.count()) {
      const toolbarBox = await toolbar.boundingBox();
      expect(box!.y + box!.height).toBeLessThan(toolbarBox!.y);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
});

test("skipping the envelope leaves music off until the note is pressed", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Пропустити", exact: true }).click();
  expect(await page.locator("audio").evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
});

test("a previously muted visit cannot prevent the envelope from starting music", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("invitation-music-muted", "true"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const audio = page.locator("audio");
  await page.getByRole("button", { name: "Відкрити конверт", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => audio.evaluate((e: HTMLAudioElement) => e.paused)).toBe(false);
  await page.locator("#letters").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Вимкнути музику", exact: true }).click();
  await page.locator(".closing").scrollIntoViewIfNeeded();
  expect(await audio.evaluate((e: HTMLAudioElement) => e.paused)).toBe(true);
  await page.getByRole("button", { name: "Відкрити конверт ще раз", exact: true }).click();
  await page.getByRole("button", { name: "Відкрити запрошення", exact: true }).click();
  await expect.poll(() => audio.evaluate((e: HTMLAudioElement) => e.paused)).toBe(false);
  await page.getByRole("button", { name: "Вимкнути музику", exact: true }).click();
  expect(await audio.evaluate((e: HTMLAudioElement) => e.paused)).toBe(true);
});

test("hiding or suspending the page stops music and returning never resumes it automatically", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Відкрити конверт", exact: true }).click();
  const audio = page.locator("audio");
  await expect.poll(() => audio.evaluate((e: HTMLAudioElement) => e.paused)).toBe(false);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => audio.evaluate((e: HTMLAudioElement) => e.paused)).toBe(true);
  await expect(page.getByRole("button", { name: "Увімкнути музику", exact: true })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(await audio.evaluate((e: HTMLAudioElement) => e.paused)).toBe(true);
  await page.getByRole("button", { name: "Увімкнути музику", exact: true }).click();
  await expect.poll(() => audio.evaluate((e: HTMLAudioElement) => e.paused)).toBe(false);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
  expect(await audio.evaluate((e: HTMLAudioElement) => e.paused)).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  expect(await audio.evaluate((e: HTMLAudioElement) => e.paused)).toBe(true);
});

test("leaving stops playback and a new visitor hears music only after opening their own envelope", async ({ page, browser }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const url = page.url();
  await page.getByRole("button", { name: "Відкрити конверт", exact: true }).click();
  await expect.poll(() => page.locator("audio").evaluate((e: HTMLAudioElement) => e.paused)).toBe(false);
  await page.evaluate(() => window.addEventListener("pagehide", () => {
    localStorage.setItem("music-paused-on-departure", String(document.querySelector("audio")!.paused));
  }, { once: true }));
  await page.goto("about:blank");
  await page.goBack();
  expect(await page.evaluate(() => localStorage.getItem("music-paused-on-departure"))).toBe("true");
  expect(await page.locator("audio").evaluate((e: HTMLAudioElement) => e.paused)).toBe(true);

  const visitor = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  try {
    const freshPage = await visitor.newPage();
    await freshPage.goto(url);
    await expect(freshPage.getByRole("dialog")).toBeVisible();
    expect(await freshPage.locator("audio").evaluate((e: HTMLAudioElement) => e.paused)).toBe(true);
    await freshPage.getByRole("button", { name: "Відкрити конверт", exact: true }).tap();
    await expect.poll(() => freshPage.locator("audio").evaluate((e: HTMLAudioElement) => e.paused)).toBe(false);
  } finally { await visitor.close(); }
});
