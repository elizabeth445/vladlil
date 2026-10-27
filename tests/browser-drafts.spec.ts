import { test, expect } from "@playwright/test";

async function enter(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Пропустити", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("letter and RSVP drafts survive reload independently", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  await page.locator("#tab-vladyslav").click();
  await page.locator("#vladyslav-identity").fill("Чернетка Владиславу");
  await page.locator("#tab-liliia").click();
  await page.locator("#liliia-identity").fill("Чернетка Лілії");
  await page.locator("#rsvp-name").fill("Чернетка гостя");
  await page.locator("#rsvp-guests").selectOption("3");
  await page.locator("#rsvp-comment").fill("Коментар збережено");
  await enter(page);
  await page.locator("#tab-liliia").click();
  await expect(page.locator("#liliia-identity")).toHaveValue("Чернетка Лілії");
  await page.locator("#tab-vladyslav").click();
  await expect(page.locator("#vladyslav-identity")).toHaveValue("Чернетка Владиславу");
  await expect(page.locator("#rsvp-name")).toHaveValue("Чернетка гостя");
  await expect(page.locator("#rsvp-guests")).toHaveValue("3");
  await expect(page.locator("#rsvp-comment")).toHaveValue("Коментар збережено");
});
