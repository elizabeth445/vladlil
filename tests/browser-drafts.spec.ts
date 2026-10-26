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

test("public draft mode saves only in the browser and closes server submissions", async ({ page }) => {
  test.skip(process.env.TEST_DRAFT_ONLY !== "1", "Runs against the draft-only production build");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const submissions: string[] = [];
  page.on("request", request => {
    if (request.method() === "POST") submissions.push(request.url());
  });
  await enter(page);
  await page.locator("#tab-liliia").click();
  for (const field of await page.locator("#panel-liliia textarea").all()) {
    await field.fill("Теплі слова для Лілії");
  }
  await page.locator("#panel-liliia").getByRole("button", { name: "Зберегти чернетку на пристрої" }).click();
  await expect(page.locator("#panel-liliia [role=status]")).toContainText("Організаторам її не надіслано");
  await page.locator("#rsvp-name").fill("Марія");
  await page.locator("#rsvp").getByRole("button", { name: "Зберегти чернетку на пристрої" }).click();
  await expect(page.locator("#rsvp [role=status]")).toContainText("Організаторам її не надіслано");
  await expect(page.locator(".rsvp-success, .letter-success")).toHaveCount(0);
  expect(submissions).toEqual([]);
  for (const route of ["/api/rsvp", "/api/letters"]) {
    const response = await page.request.post(route, { data: {} });
    expect(response.status()).toBe(503);
    expect((await response.json()).saved).toBe(false);
  }
  expect((await page.request.get("/admin")).status()).toBe(404);
  expect((await page.request.get("/api/admin/export")).status()).toBe(404);
  expect((await page.request.post("/api/admin/login", {data: {}})).status()).toBe(404);
});
