import { test, expect } from "@playwright/test";

test("iPhone WebKit: closing greeting stays connected and settles after touch replay", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Пропустити", exact: true }).tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const greeting = page.getByRole("button", {
    name: "Привітатися з іменинниками ще раз",
  });
  await greeting.scrollIntoViewIfNeeded();
  await page.waitForTimeout(4100);
  await greeting.tap();
  await page.waitForTimeout(1950);
  await expect(greeting.locator(".greeting-pose-wave").first()).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(greeting.locator("mask, clipPath")).toHaveCount(0);
  await page.screenshot({
    path: "output/playwright/iphone-webkit-greeting.png",
  });
  await expect(greeting.locator(".greeting-pose-1").first()).toHaveCSS(
    "opacity",
    "1",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await greeting.tap();
  await expect(greeting.locator(".greeting-pose-wave").first()).toHaveCSS(
    "opacity",
    "0",
  );
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
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
      .getByRole("button", { name: "Повернути кульку «Годин»" })
      .locator(".balloon-remnant"),
  ).toBeVisible();
  await page.screenshot({
    path: "output/playwright/iphone-webkit-balloons.png",
  });
  await page.getByRole("button", { name: "Повернути кульку «Годин»" }).tap();
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
