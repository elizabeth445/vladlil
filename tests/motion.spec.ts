import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("watercolor postcard responds to pointer and keyboard, settles and respects reduced motion", async ({ page }) => {
  await enter(page);
  const photo = page.getByRole("button", {
    name: "Пожвавити акварельну листівку ресторану FRANCO",
  });
  await photo.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1900);
  await photo.hover({ position: { x: 30, y: 30 } });
  await expect.poll(() => photo.evaluate(e =>
    new DOMMatrixReadOnly(getComputedStyle(e).transform).m42,
  )).toBeLessThan(-3);
  await photo.click();
  const sparkles = page.locator(".venue-twinkle");
  await expect.poll(() => sparkles.evaluateAll(elements =>
    Math.max(...elements.map(e => Number(getComputedStyle(e).opacity))),
  )).toBeGreaterThan(0.3);
  await expect(sparkles.first()).toHaveCSS("opacity", "0");
  await photo.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => sparkles.evaluateAll(elements =>
    Math.max(...elements.map(e => Number(getComputedStyle(e).opacity))),
  )).toBeGreaterThan(0.3);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(sparkles.first()).toHaveCSS("opacity", "0");
  await photo.click();
  await expect.poll(() => photo.evaluate(e => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(e).transform);
    return Math.abs(matrix.m42) + Math.abs(matrix.m13) + Math.abs(matrix.m23);
  })).toBe(0);
});

test("closing greeting turns to the guest, waves gently, settles and replays", async ({
  page,
}) => {
  await enter(page);
  const greeting = page.getByRole("button", {
    name: "Привітатися з іменинниками ще раз",
  });
  await greeting.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1900);
  await expect(greeting.locator(".greeting-pose-wave").first()).toHaveCSS("opacity", "1");
  await expect(greeting.locator(".greeting-pose-wave").first()).toHaveCSS("opacity", "0");
  await expect(greeting.locator(".greeting-toys")).toHaveCount(0);
  await page.locator("#rsvp").scrollIntoViewIfNeeded();
  await greeting.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1900);
  await expect(greeting.locator(".greeting-pose-wave").first()).toHaveCSS("opacity", "1");
  await expect(greeting.locator(".greeting-pose-wave").first()).toHaveCSS("opacity", "0");
  await greeting.click();
  await expect(greeting.locator(".greeting-pose-0").first()).toHaveCSS(
    "opacity",
    "1",
  );
  await page.waitForTimeout(1900);
  await expect(greeting.locator(".greeting-pose-wave").first()).toHaveCSS(
    "opacity",
    "1",
  );
  expect(
    await greeting
      .locator(".greeting-paw-motion")
      .first()
      .evaluate((e) => {
        return Math.abs(Number(e.getAttribute("scale")));
      }),
  ).toBeLessThanOrEqual(8.6);
  await expect(greeting.locator(".greeting-pose-1").first()).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(greeting.locator(".greeting-pose-wave").first()).toHaveCSS(
    "opacity",
    "0",
  );
  await greeting.focus();
  await page.keyboard.press("Enter");
  await expect(greeting.locator(".greeting-pose-0").first()).toHaveCSS(
    "opacity",
    "1",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(greeting.locator(".greeting-pose-1").first()).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(greeting.locator(".greeting-pose-0").first()).toHaveCSS(
    "opacity",
    "0",
  );
  await greeting.click();
  await expect(greeting.locator(".greeting-pose-wave").first()).toHaveCSS(
    "opacity",
    "0",
  );
});
async function enter(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Пропустити", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("h1")).toBeVisible();
}
test("replay preserves letters, folds flap behind paper and remains skippable", async ({
  page,
}) => {
  await enter(page);
  await page.locator("#tab-liliia").click();
  await page.locator("#liliia-identity").fill("Чернетка, яку треба зберегти");
  await page
    .getByRole("button", { name: "Відкрити запрошення ще раз" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page
    .getByRole("button", { name: "Відкрити запрошення", exact: true })
    .click();
  await page.waitForTimeout(1900);
  const geometry = await page.evaluate(() => {
    const card = document
        .querySelector(".envelope-letter")!
        .getBoundingClientRect(),
      pocket = document
        .querySelector(".envelope-front")!
        .getBoundingClientRect();
    return {
      bottom: card.bottom,
      top: pocket.top,
      flapZ: getComputedStyle(document.querySelector(".envelope-flap")!).zIndex,
    };
  });
  expect(geometry.flapZ).toBe("0");
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.top + 5);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("#liliia-identity")).toHaveValue(
    "Чернетка, яку треба зберегти",
  );
  await page
    .getByRole("button", { name: "Відкрити запрошення ще раз" })
    .click();
  await page.getByRole("button", { name: "Пропустити", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("hero parallax moves layers at different speeds and resets on reverse scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await page.evaluate(() => scrollTo({ top: 300, behavior: "instant" }));
  await page.waitForTimeout(900);
  const motion = await page.evaluate(() => {
    const y = (selector: string) =>
      new DOMMatrixReadOnly(
        getComputedStyle(document.querySelector(selector)!).transform,
      ).m42;
    return {
      air: y(".hero-air-layer"),
      cloud: y(".hero-cloud-layer"),
      lion: y(".hero-lion-depth"),
      kitten: y(".hero-kitten-depth"),
    };
  });
  expect(motion.air).toBeLessThan(motion.cloud);
  expect(motion.kitten).toBeLessThan(motion.lion);
  expect(motion.lion).toBeLessThan(-5);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(900);
  expect(
    await page
      .locator(".hero-air-layer")
      .evaluate(
        (e) => new DOMMatrixReadOnly(getComputedStyle(e).transform).m42,
      ),
  ).toBeCloseTo(0, 0);
});
test("balloons pop with confetti and automatically become ready for another pop", async ({ page }) => {
  await enter(page);
  await page.locator(".birthday-clock").scrollIntoViewIfNeeded();
  const balloon = page.getByRole("button", { name: "Лопнути кульку «Днів»" });
  await balloon.click();
  await page.waitForTimeout(250);
  await expect(balloon).toHaveAttribute("aria-pressed", "true");
  await expect(balloon).toHaveAttribute("aria-disabled", "true");
  expect(await balloon.locator(".confetti-piece").evaluateAll(xs =>
    xs.some(e => Number(getComputedStyle(e).opacity) > 0),
  )).toBe(true);
  await expect(balloon.locator(".balloon-remnant")).toBeVisible();
  await expect(balloon).toHaveAttribute("aria-disabled", "false");
  await expect(balloon).toHaveAttribute("aria-pressed", "false");
  await expect(balloon.locator(".balloon-pop-art")).toHaveCSS("opacity", "1");
  await balloon.click();
  await expect(balloon).toHaveAttribute("aria-pressed", "true");
  await expect(balloon).toHaveAttribute("aria-pressed", "false");
  for (const unit of ["Днів", "Годин", "Хвилин", "Секунд"])
    await page.getByRole("button", { name: `Лопнути кульку «${unit}»` }).click();
  await expect(page.getByRole("button", { name: /Повернути.*кульк/ })).toHaveCount(0);
  await expect(page.locator(".clock-pop[aria-pressed=true]")).toHaveCount(0);
  expect(await page.locator(".confetti-piece").evaluateAll(xs =>
    xs.every(e => Number(getComputedStyle(e).opacity) === 0),
  )).toBe(true);
});
test("reduced motion removes parallax and confetti, replay stays keyboard accessible", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  await page
    .getByRole("button", { name: "Відкрити запрошення ще раз" })
    .click();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator(".birthday-clock").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Лопнути кульку «Днів»" }).click();
  await expect(
    page.locator(".clock-pop.is-popped .balloon-remnant"),
  ).toBeVisible();
  expect(
    await page
      .locator(".confetti-piece")
      .evaluateAll((xs) =>
        xs.every((e) => Number(getComputedStyle(e).opacity) === 0),
      ),
  ).toBe(true);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
});

test("repeated replay keeps narrow layouts and paper angle stable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await enter(page);
  for (let i = 0; i < 4; i++) {
    await page
      .getByRole("button", { name: "Відкрити запрошення ще раз" })
      .click();
    expect(await page.locator(".opening").evaluate((e) => e.scrollWidth)).toBe(
      320,
    );
    await page.getByRole("button", { name: "Пропустити", exact: true }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(320);
  }
  expect(
    await page
      .locator(".calendar-paper")
      .evaluate((e) => getComputedStyle(e).rotate),
  ).toBe("2deg");
});

test("desktop paper never intersects the dedication, including short windows", async ({
  page,
}) => {
  await enter(page);
  for (const viewport of [
    { width: 1440, height: 650 },
    { width: 1440, height: 720 },
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    await page
      .getByRole("button", { name: "Відкрити запрошення ще раз" })
      .click();
    await page
      .getByRole("button", { name: "Відкрити запрошення", exact: true })
      .click();
    await page.waitForTimeout(1850);
    await expect(page.locator(".opening-caption")).toHaveCSS("opacity", "0");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});
test("painted frame keeps proportions and characters and butterfly respond to input", async ({
  page,
}) => {
  await enter(page);
  await page.waitForTimeout(900);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    expect(
      await page
        .locator(".hero-frame img")
        .first()
        .evaluate((e) => getComputedStyle(e).objectFit),
    ).toBe("contain");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
  }
  await page.getByRole("button", { name: "Привітатися з левеням" }).click();
  await expect(
    page.locator(".character-play-lion .character-greeting"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Погладити кошеня" }).click();
  await expect(
    page.locator(".character-play-kitten .character-greeting"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Пограти з метеликом" }).click();
  await page.waitForTimeout(350);
  expect(
    await page
      .locator(".butterfly-flight")
      .evaluate(
        (e) => new DOMMatrixReadOnly(getComputedStyle(e).transform).m42,
      ),
  ).toBeLessThan(-5);
  await page.waitForTimeout(1600);
  expect(
    await page
      .locator(".butterfly-flight")
      .evaluate(
        (e) => new DOMMatrixReadOnly(getComputedStyle(e).transform).m42,
      ),
  ).toBeCloseTo(0, 0);
});
