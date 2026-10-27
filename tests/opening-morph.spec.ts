import { test, expect } from "@playwright/test";

for (const width of [390, 1440]) {
  test(`shared text and characters keep continuous geometry through the morph at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/");
    await page.getByRole("button", { name: "Відкрити запрошення", exact: true }).click();
    await expect(page.locator(".invitation-morph-item")).toHaveCount(7);
    await expect(page.locator(".invitation-morph")).toBeVisible();
    const geometry = await page.evaluate(() => new Promise<{
      minWidth: number; maxStartError: number; maxLandingError: number; duplicate: boolean;
    }>(resolve => {
      const rectangle = (element: Element) => {
        const r = element.getBoundingClientRect();
        return [r.x, r.y, r.width, r.height];
      };
      const items = Array.from(document.querySelectorAll<HTMLElement>(".invitation-morph-item"));
      const first = items.map(rectangle);
      const sources = items.map(item => rectangle(document.querySelector(`.opening [data-morph="${item.dataset.morphKey}"]`)!));
      const maxStartError = Math.max(...first.flatMap((rect, i) => rect.map((value, j) => Math.abs(value - sources[i][j]))));
      let last = first, minWidth = Infinity, duplicate = false;
      const tick = () => {
        if (!document.querySelector(".invitation-morph")) {
          const targets = items.map(item => rectangle(document.querySelector(`#home [data-morph="${item.dataset.morphKey}"]`)!));
          const maxLandingError = Math.max(...last.flatMap((rect, i) => rect.map((value, j) => Math.abs(value - targets[i][j]))));
          resolve({ minWidth, maxStartError, maxLandingError, duplicate });
          return;
        }
        last = items.map(rectangle);
        minWidth = Math.min(minWidth, ...last.map(rect => rect[2]));
        duplicate ||= items.some(item => getComputedStyle(document.querySelector(`#home [data-morph="${item.dataset.morphKey}"]`)!).visibility !== "hidden");
        requestAnimationFrame(tick);
      };
      tick();
    }));
    expect(geometry.minWidth).toBeGreaterThan(8);
    expect(geometry.maxStartError).toBeLessThan(12);
    expect(geometry.maxLandingError).toBeLessThan(3);
    expect(geometry.duplicate).toBe(false);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("#hero-title")).toBeFocused();
    await expect(page.locator(".hero-names > span").first()).toHaveAttribute("data-reveal-state", "complete");
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

test("morph safely settles on Escape, resize and a live reduced-motion change", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  for (const action of ["escape", "resize", "reduce"]) {
    if (action !== "escape") {
      await page.getByRole("button", { name: "Відкрити запрошення ще раз", exact: true }).click();
    }
    await page.getByRole("button", { name: "Відкрити запрошення", exact: true }).click();
    await expect(page.locator(".invitation-morph")).toHaveCount(1);
    if (action === "escape") await page.keyboard.press("Escape");
    if (action === "resize") await page.setViewportSize({ width: 768, height: 900 });
    if (action === "reduce") await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".invitation-morph")).toHaveCount(0);
    await expect(page.locator(".hero-description")).toHaveCSS("opacity", "1");
    expect(await page.locator("#home [data-morph]").evaluateAll(elements =>
      elements.every(element => getComputedStyle(element).visibility === "visible"),
    )).toBe(true);
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  }
});

test("opening is immediately clickable and accelerates the remaining balloons", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".opening-arrival")).toBeVisible();
  const open = page.getByRole("button", { name: "Відкрити запрошення", exact: true });
  await expect(open).toBeEnabled();
  await expect(page.getByRole("button", { name: "Відкрити конверт", exact: true })).toBeEnabled();
  await open.click();
  await expect(page.locator(".opening-button")).toBeDisabled();
  await expect(page.locator(".opening-arrival")).toHaveCount(0, { timeout: 1200 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("originals stay painted until decoded copies are ready and the final handoff never rewinds the entrance", async ({ page }) => {
  await page.addInitScript(() => {
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = async function () {
      if (this.closest(".invitation-morph")) await new Promise(resolve => setTimeout(resolve, 400));
      return decode.call(this);
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Відкрити запрошення", exact: true }).click();
  const stage = page.locator(".invitation-morph");
  await expect(stage).toHaveCount(1);
  await expect(stage).toHaveCSS("visibility", "hidden");
  expect(await page.locator(".opening [data-morph]").evaluateAll(elements =>
    elements.every(element => getComputedStyle(element).visibility === "visible"),
  )).toBe(true);
  await expect(stage).toHaveCSS("visibility", "visible");
  const continuity = await page.evaluate(() => new Promise<{ missingFrames: number; dimmedCopies: number; entranceReturned: boolean }>(resolve => {
    const stage = document.querySelector<HTMLElement>(".invitation-morph")!;
    const opening = document.querySelector<HTMLElement>(".opening")!;
    const items = Array.from(stage.querySelectorAll<HTMLElement>(".invitation-morph-item"));
    let missingFrames = 0, dimmedCopies = 0, entranceReturned = false, entranceFaded = false;
    const visible = (element: Element | null): boolean => {
      if (!element?.isConnected) return false;
      if (element instanceof HTMLImageElement && (!element.complete || !element.naturalWidth)) return false;
      for (let node: Element | null = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) < 0.99) return false;
      }
      return true;
    };
    const sample = () => {
      if (opening.isConnected && getComputedStyle(opening).display !== "none") {
        const opacity = Number(getComputedStyle(opening).opacity);
        if (opacity < 0.01) entranceFaded = true;
        if (entranceFaded && opacity > 0.05) entranceReturned = true;
      }
      for (const item of items) {
        const target = document.querySelector(`#home [data-morph="${item.dataset.morphKey}"]`);
        const copy = item.firstElementChild;
        if (!visible(copy) && !visible(target)) missingFrames++;
        if (item.isConnected && copy && Number(getComputedStyle(copy).opacity) < 0.99) dimmedCopies++;
      }
      if (!stage.isConnected) {
        resolve({ missingFrames, dimmedCopies, entranceReturned });
        return;
      }
      requestAnimationFrame(sample);
    };
    sample();
  }));
  expect(continuity).toEqual({ missingFrames: 0, dimmedCopies: 0, entranceReturned: false });
  await expect(page.locator(".hero-names .split-char")).toHaveCount(0);
});
