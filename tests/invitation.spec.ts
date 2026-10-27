import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { countdown, calendarDays, EVENT } from "../lib/event";
import { randomUUID } from "node:crypto";
const identity = `QA ${randomUUID().slice(0, 8)}`;
async function enter(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Пропустити", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("h1")).toBeVisible();
}
test("Kyiv countdown and Monday calendar", () => {
  expect(Date.parse(EVENT.start)).toBe(Date.parse("2026-11-15T14:00:00Z"));
  expect(countdown(Date.parse(EVENT.start) - 90061000).values).toEqual([
    1, 1, 1, 1,
  ]);
  expect(countdown(Date.parse(EVENT.start) + 1000)).toEqual({
    finished: true,
    values: [0, 0, 0, 0],
  });
  const days = calendarDays();
  expect(days.slice(0, 6)).toEqual([null, null, null, null, null, null]);
  expect(days.indexOf(15) % 7).toBe(6);
});
test("opening works by keyboard, repeats on reload and replays from the footer", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Відкрити запрошення", exact: true }),
  ).toBeFocused({ timeout: 12000 });
  expect(await page.evaluate(() => document.body.style.overflow)).toBe(
    "hidden",
  );
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  await expect(page.locator("h1")).toBeFocused();
  await page.reload();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".opening-arrival")).toBeVisible();
  await page.getByRole("button", { name: "Пропустити", exact: true }).click();
  await page.getByRole("button", { name: "Відкрити конверт ще раз", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".opening-arrival")).toBeVisible();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("320–1440 layouts, calendar heart, independent letter drafts and mobile menu", async ({
  page,
}) => {
  await enter(page);
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator("#tab-vladyslav").click();
    await page.locator("#vladyslav-identity").fill(identity);
    await page.locator("#tab-liliia").click();
    await page.locator("#liliia-identity").fill("Лист для Лілії");
    await page.locator("#tab-vladyslav").click();
    await expect(page.locator("#vladyslav-identity")).toHaveValue(identity);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const questions = page.locator("#panel-vladyslav .question textarea");
    await expect(questions).toHaveCount(5);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.getByRole("button", { name: "Відкрити меню" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Коли й де" })
    .click();
  await expect(
    page.getByRole("button", { name: "Відкрити меню" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "15 листопада — наше свято" }).click();
  await expect(page.locator("#date-note")).toContainText("Початок о 16:00");
  const heart = page.locator(".date-heart path");
  // The outline redraws automatically, without using the date button.
  await expect
    .poll(
      () =>
        heart.evaluate((e) => parseFloat(getComputedStyle(e).strokeDashoffset)),
      { timeout: 6000 },
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      heart.evaluate((e) => parseFloat(getComputedStyle(e).strokeDashoffset)),
    )
    .toBe(0);
});
test("network error never shows success and preserves draft", async ({
  page,
}) => {
  await enter(page);
  await page.locator("#tab-liliia").click();
  for (const key of [
    "identity",
    "resemblance",
    "character",
    "future",
    "wishes",
  ])
    await page.locator(`#liliia-${key}`).fill("Тестовий лист без мережі");
  await page.route("**/api/submit", (r) => r.abort("failed"));
  await page.locator("#panel-liliia button[type=submit]").click();
  await expect(page.locator("#panel-liliia [role=alert]")).not.toBeEmpty();
  await expect(page.locator("#liliia-wishes")).toHaveValue(
    "Тестовий лист без мережі",
  );
  await expect(page.locator("#panel-liliia .letter-success")).toHaveCount(0);
});
test("calendar download and retired database routes", async ({ request }) => {
  const ics = await request.get("/api/calendar");
  expect(ics.headers()["content-type"]).toContain("text/calendar");
  expect((await ics.text()).replace(/\r\n /g, "")).toContain("DTSTART;TZID=Europe/Kyiv:20261115T160000");
  for (const path of ["/admin", "/api/admin/export", "/api/admin/login", "/api/letters", "/api/rsvp"]) {
    expect((await request.get(path)).status()).toBe(404);
  }
});
test("reduced motion, accessible main page and letters", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  await page.locator("#tab-liliia").click();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  expect(
    await page
      .locator(".date-heart path")
      .evaluate((e) => parseFloat(getComputedStyle(e).strokeDashoffset)),
  ).toBe(0);
});
