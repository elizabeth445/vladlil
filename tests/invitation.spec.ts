import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { countdown, calendarDays, EVENT } from "../lib/event";
import { csvCell } from "../lib/csv";
import { randomUUID, createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
const origin = "http://127.0.0.1:3000";
const identity = `QA ${randomUUID().slice(0, 8)}`;
const cleanupIds: string[] = [];
test.afterAll(() => {
  if (!existsSync(".data/invitation.sqlite")) return;
  const db = new DatabaseSync(".data/invitation.sqlite");
  for (const id of cleanupIds) {
    db.prepare("DELETE FROM guest_letters WHERE request_id=?").run(id);
    db.prepare("DELETE FROM rsvp_responses WHERE request_id=?").run(id);
  }
  const auth = JSON.parse(readFileSync(".data/auth.json", "utf8"));
  for (const scope of ["submission", "login"])
    db.prepare("DELETE FROM rate_limits WHERE key=?").run(
      createHmac("sha256", auth.rateSecret)
        .update(`${scope}:local`)
        .digest("hex"),
    );
  db.close();
});
async function enter(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Пропустити", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("h1")).toBeVisible();
}
test("Kyiv countdown, Monday calendar and CSV injection protection", () => {
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
  expect(csvCell(" =SUM(1,2)")).toBe('"\' =SUM(1,2)"');
  expect(csvCell('Теплі "слова"')).toBe('"Теплі ""слова"""');
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
test("local letters save independently, errors retain text, RSVP saves", async ({
  page,
}) => {
  await enter(page);
  for (const child of ["vladyslav", "liliia"]) {
    await page.locator(`#tab-${child}`).click();
    for (const [i, key] of [
      "identity",
      "resemblance",
      "character",
      "future",
      "wishes",
    ].entries())
      await page
        .locator(`#${child}-${key}`)
        .fill(i === 0 ? identity : `Теплі слова для ${child} — відповідь ${i}`);
    let sentId = "";
    page.once("request", (request) => {
      if (request.url().endsWith("/api/letters"))
        sentId = request.postDataJSON().request_id;
    });
    const responsePromise = page.waitForResponse((r) =>
      r.url().endsWith("/api/letters"),
    );
    await page.waitForTimeout(2100);
    await page.locator(`#panel-${child} button[type=submit]`).click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    cleanupIds.push(response.request().postDataJSON().request_id);
    void sentId;
    await expect(page.locator(`#panel-${child} [role=status]`)).toContainText(
      "збережено",
    );
  }
  await page.locator("#rsvp-name").fill(identity);
  await page.locator("#rsvp-guests").selectOption("3");
  await page.locator("#rsvp-comment").fill("Тестове підтвердження присутності");
  page.once("request", (r) => {
    if (r.url().endsWith("/api/rsvp"))
      cleanupIds.push(r.postDataJSON().request_id);
  });
  const saved = page.waitForResponse((r) => r.url().endsWith("/api/rsvp"));
  await page.getByRole("button", { name: "Надіслати відповідь" }).click();
  expect((await saved).status()).toBe(201);
  await expect(page.locator(".rsvp-success")).toContainText("Дякуємо");
  await expect(page.locator(".rsvp-success h3")).toContainText(identity);
  const db = new DatabaseSync(".data/invitation.sqlite");
  expect(
    (
      db
        .prepare("SELECT COUNT(*) AS n FROM guest_letters WHERE guest_name=?")
        .get(identity) as { n: number }
    ).n,
  ).toBe(2);
  expect(
    (
      db
        .prepare("SELECT guests FROM rsvp_responses WHERE guest_name=?")
        .get(identity) as { guests: number }
    ).guests,
  ).toBe(3);
  db.close();
});
test("server validation, same-origin protection and idempotent retries", async ({
  request,
}) => {
  const payload = {
    child: "vladyslav",
    answers: {
      identity,
      resemblance: "На маму",
      character: "Добрий",
      future: "Мандрівник",
      wishes: "Будь щасливим",
    },
    website: "",
    started_at: Date.now() - 3000,
    request_id: randomUUID(),
  };
  cleanupIds.push(payload.request_id);
  const first = await request.post("/api/letters", {
    headers: { origin },
    data: payload,
  });
  expect(first.status()).toBe(201);
  const repeated = await request.post("/api/letters", {
    headers: { origin },
    data: payload,
  });
  expect((await repeated.json()).id).toBe((await first.json()).id);
  expect(
    (
      await request.post("/api/letters", {
        headers: { origin },
        data: {
          ...payload,
          request_id: randomUUID(),
          answers: { ...payload.answers, wishes: "" },
        },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/letters", {
        headers: { origin: "https://example.com" },
        data: payload,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/letters", {
        headers: { origin },
        data: { ...payload, website: "spam" },
      })
    ).status(),
  ).toBe(400);
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
  await page.route("**/api/letters", (r) => r.abort("failed"));
  await page.locator("#panel-liliia button[type=submit]").click();
  await expect(page.locator("#panel-liliia [role=alert]")).not.toBeEmpty();
  await expect(page.locator("#liliia-wishes")).toHaveValue(
    "Тестовий лист без мережі",
  );
  await expect(page.locator("#panel-liliia .letter-success")).toHaveCount(0);
});
test("calendar file, private admin authentication, CSV export and logout", async ({
  page,
  request,
}) => {
  const ics = await request.get("/api/calendar");
  expect(ics.headers()["content-type"]).toContain("text/calendar");
  const contents = (await ics.text()).replace(/\r\n /g, "");
  expect(contents).toContain("DTSTART;TZID=Europe/Kyiv:20261115T160000");
  expect(contents).toContain("Обухівське шосе");
  expect((await request.get("/api/admin/export")).status()).toBe(401);
  await page.goto("/admin");
  await expect(page.getByLabel("Пароль")).toBeVisible();
  // Use the generated local password without exposing it in test output.
  const access = readFileSync(".data/admin-access.txt", "utf8");
  const password = access.match(/Пароль: (.+)/)?.[1];
  expect(password).toBeTruthy();
  await page.getByLabel("Пароль").fill(password!);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await expect(page.getByRole("link", { name: "Усі листи" })).toBeVisible();
  const exportResult = await page.request.get("/api/admin/export");
  expect(exportResult.status()).toBe(200);
  expect(await exportResult.text()).toContain("Дитина");
  const cookie = (await page.context().cookies()).find(
    (c) => c.name === "birthday_admin",
  );
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Strict");
  await page.getByRole("button", { name: "Вийти" }).click();
  await expect(page.getByLabel("Пароль")).toBeVisible();
  expect((await page.request.get("/api/admin/export")).status()).toBe(401);
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
