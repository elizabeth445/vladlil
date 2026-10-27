import { test, expect, type Page } from "@playwright/test";
import { answerKeys } from "../lib/event";

async function assertEmpty(page: Page) {
  for (const child of ["vladyslav", "liliia"]) {
    await page.locator(`#tab-${child}`).click();
    for (const key of answerKeys) await expect(page.locator(`#${child}-${key}`)).toHaveValue("");
  }
  await expect(page.locator("#rsvp-name")).toHaveValue("");
  await expect(page.locator("#rsvp-comment")).toHaveValue("");
  await expect(page.locator("#rsvp-guests")).toHaveValue("1");
}

test("all forms discard answers on reload and remove only legacy answer storage", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("birthday:letter:vladyslav:v1", JSON.stringify({ identity: "Попередній гість" }));
    localStorage.setItem("birthday:letter:liliia:v1", JSON.stringify({ identity: "Попередня гостя" }));
    localStorage.setItem("birthday:rsvp:v1", JSON.stringify({ guest_name: "Інша родина", guests: "5", comment: "Стара відповідь" }));
    localStorage.setItem("unrelated-preference", "keep");
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Пропустити", exact: true }).click();
  await assertEmpty(page);
  for (const child of ["vladyslav", "liliia"]) {
    await page.locator(`#tab-${child}`).click();
    for (const key of answerKeys) await page.locator(`#${child}-${key}`).fill(`Відповідь для ${child}`);
  }
  await page.locator("#rsvp-name").fill("Поточний гість");
  await page.locator("#rsvp-guests").selectOption("3");
  await page.locator("#rsvp-comment").fill("Поточний коментар");
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("birthday:")))).toEqual([]);
  await page.reload();
  await page.getByRole("button", { name: "Пропустити", exact: true }).click();
  await assertEmpty(page);
  expect(await page.evaluate(() => localStorage.getItem("unrelated-preference"))).toBe("keep");
});

test("another visitor always receives empty forms", async ({ page, browser }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Пропустити", exact: true }).click();
  await page.locator("#tab-vladyslav").click();
  await page.locator("#vladyslav-identity").fill("Ім’я першого гостя");
  const visitor = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
  try {
    const fresh = await visitor.newPage(); await fresh.goto(page.url());
    await fresh.getByRole("button", { name: "Пропустити", exact: true }).click();
    await assertEmpty(fresh);
  } finally { await visitor.close(); }
});
