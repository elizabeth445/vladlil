import { test, expect } from "@playwright/test";

test("iPhone WebKit: shared names and animals fly into the hero without a second reveal", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".shared-character-visual img")).toHaveCount(2);
  const originals = await page.locator(".shared-character-visual img").elementHandles();
  expect(originals).toHaveLength(2);
  await page.getByRole("button", { name: "Відкрити запрошення", exact: true }).tap();
  await expect(page.locator(".invitation-morph-item")).toHaveCount(7);
  await page.waitForTimeout(650);
  expect(await page.locator(".invitation-morph-item").evaluateAll(elements =>
    elements.every(element => element.getBoundingClientRect().width > 8),
  )).toBe(true);
  await page.screenshot({ path: "output/playwright/iphone-webkit-morph-flight.png" });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".invitation-morph")).toHaveCount(0);
  for (const image of originals) expect(await image.evaluate(element => element instanceof Element && !!element.closest("#home"))).toBe(true);
  await expect(page.locator(".hero-names > span").first()).toHaveAttribute("data-reveal-state", "complete");
  expect(await page.locator("#home [data-morph]").evaluateAll(elements =>
    elements.every(element => getComputedStyle(element).visibility === "visible"),
  )).toBe(true);
});

test("iPhone WebKit: invitation gesture starts music and touch control pauses it", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("invitation-music-muted", "true"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const audio = page.locator("audio");
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  await page.locator(".opening-caption").tap();
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Відкрити запрошення", exact: true }).tap();
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Вимкнути музику", exact: true }).tap();
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  await page.getByRole("button", { name: "Відкрити запрошення ще раз", exact: true }).tap();
  await expect(page.getByRole("button", { name: "Увімкнути музику", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Пропустити", exact: true }).tap();
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  await page.getByRole("button", { name: "Увімкнути музику", exact: true }).tap();
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(false);
});

test("iPhone WebKit: original seated characters and closing captions stay static", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Пропустити", exact: true }).tap();
  await expect(page.locator("#home .closing-caption")).toHaveCount(0);
  const greeting = page.locator(".closing-greeting");
  await greeting.scrollIntoViewIfNeeded();
  await expect(greeting.locator(".seated-character")).toHaveCount(2);
  await expect(greeting).toContainText("Радий вас бачити!");
  await expect(greeting).toContainText("Мур-р! До зустрічі!");
  await greeting.tap();
  await expect(greeting.locator("button, .rig-shoulder")).toHaveCount(0);
  for (const image of await greeting.locator("img").all()) await expect(image).toHaveCSS("transform", "none");
  await page.screenshot({ path: "output/playwright/iphone-webkit-greeting.png" });
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
test("iPhone WebKit: readable introduction, clean paper extraction and touch replay", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.locator(".opening").evaluate((e) => e.scrollWidth)).toBe(
    390,
  );
  expect(
    await page
      .locator(".opening-dedication")
      .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
  ).toBeGreaterThanOrEqual(18);
  await page.screenshot({
    path: "output/playwright/iphone-webkit-opening.png",
  });
  await page
    .getByRole("button", { name: "Відкрити запрошення", exact: true })
    .tap();
  await page.waitForTimeout(1900);
  const rect = await page.evaluate(() => ({
    card: document.querySelector(".envelope-letter")!.getBoundingClientRect()
      .bottom,
    pocket: document.querySelector(".envelope-front")!.getBoundingClientRect()
      .top,
    textBottom: document.querySelector(".envelope-letter > small:last-child")!
      .getBoundingClientRect().bottom,
    charactersTop: Math.min(
      document.querySelector(".opening-lion")!.getBoundingClientRect().top,
      document.querySelector(".opening-kitten")!.getBoundingClientRect().top,
    ),
  }));
  expect(rect.card).toBeLessThanOrEqual(rect.pocket + 6);
  expect(rect.textBottom).toBeLessThan(rect.charactersTop);
  await page.screenshot({ path: "output/playwright/iphone-webkit-card.png" });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Відкрити запрошення ще раз" }).tap();
  await page.getByRole("button", { name: "Пропустити", exact: true }).tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.waitForTimeout(900);
  await page.screenshot({ path: "output/playwright/iphone-webkit-hero.png" });
});
test("iPhone WebKit: touch balloons, mobile navigation and independent drafts", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Пропустити", exact: true }).tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const postcard = page.getByRole("button", { name: "Пожвавити акварельну листівку ресторану FRANCO" });
  await postcard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1900);
  await postcard.tap();
  await expect.poll(() => page.locator(".venue-twinkle").evaluateAll(elements =>
    Math.max(...elements.map(e => Number(getComputedStyle(e).opacity))),
  )).toBeGreaterThan(0.3);
  await expect(page.locator(".venue-twinkle").first()).toHaveCSS("opacity", "0");
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await page.getByRole("button", { name: "Відкрити меню" }).tap();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Листи у майбутнє" })
    .tap();
  await page.locator("#tab-vladyslav").tap();
  await page.locator("#vladyslav-identity").fill("Чернетка з iPhone");
  await page.locator("#tab-liliia").tap();
  await page.locator("#liliia-identity").fill("Окрема чернетка");
  await page.locator("#tab-vladyslav").tap();
  await expect(page.locator("#vladyslav-identity")).toHaveValue(
    "Чернетка з iPhone",
  );
  await page.locator(".birthday-clock").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Лопнути кульку «Годин»" }).tap();
  await page.waitForTimeout(550);
  await expect(
    page
      .getByRole("button", { name: "Лопнути кульку «Годин»" })
      .locator(".balloon-remnant"),
  ).toBeVisible();
  await page.screenshot({
    path: "output/playwright/iphone-webkit-balloons.png",
  });
  await expect(page.locator(".clock-pop.is-popped")).toHaveCount(0);
  await page.getByRole("button", { name: "Лопнути кульку «Годин»" }).tap();
  await expect(page.locator(".clock-pop.is-popped")).toHaveCount(1);
  await expect(page.locator(".clock-pop.is-popped")).toHaveCount(0);
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await page.getByRole("button", { name: "Відкрити запрошення ще раз" }).tap();
  await page
    .getByRole("button", { name: "Відкрити запрошення", exact: true })
    .tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
