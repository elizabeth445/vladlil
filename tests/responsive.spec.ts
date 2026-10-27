import { test, expect } from "@playwright/test";

test("venue details share a text edge and center each icon on its first line", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Пропустити", exact: true }).click();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator(".venue-copy").scrollIntoViewIfNeeded();
    const rows = await page.locator(".venue-copy dl > div").evaluateAll(elements => elements.map(element => {
      const text = element.querySelector("dd")!, icon = element.querySelector("dt svg")!;
      const range = document.createRange(); range.selectNodeContents(text);
      const lines = Array.from(range.getClientRects()).filter(rect => rect.width > 0);
      const first = lines[0], image = icon.getBoundingClientRect();
      return { starts: lines.map(line => line.left), iconLeft: image.left, offset: Math.abs(image.top + image.height / 2 - first.top - first.height / 2) };
    }));
    const starts = rows.flatMap(row => row.starts);
    expect(Math.max(...starts) - Math.min(...starts)).toBeLessThan(1);
    expect(Math.max(...rows.map(row => row.iconLeft)) - Math.min(...rows.map(row => row.iconLeft))).toBeLessThan(1);
    expect(rows.every(row => row.offset < 3)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: `output/playwright/venue-aligned-${width}.png` });
  }
});

test("balloons are in the first response and leave along different paths on phone and desktop", async ({ page, request }) => {
  const html = await (await request.get("/")).text();
  expect(html).toContain("arrival-balloon-flight");
  expect(html).toContain("ribbon-balloon-pink.webp");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(page.locator(".arrival-balloon-sway img").first()).toBeVisible();
    const positions = () => page.locator(".arrival-balloon-flight:visible").evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, visible: box.right > 0 && box.left < innerWidth && box.bottom > 0 && box.top < innerHeight };
    }));
    const before = await positions();
    expect(before.filter(balloon => balloon.visible).length).toBeGreaterThan(12);
    await page.waitForTimeout(1500);
    const after = await positions();
    expect(after.some((balloon, i) => balloon.x - before[i].x > 30)).toBe(true);
    expect(after.some((balloon, i) => balloon.x - before[i].x < -30)).toBe(true);
    expect(after.some((balloon, i) => balloon.y - before[i].y < -30)).toBe(true);
    await expect(page.getByRole("button", { name: "Відкрити запрошення", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Пропустити", exact: true }).click();
  }
});

test("compact invitation centers the envelope between its hosts and keeps controls reachable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 664 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("dialog")).toBeVisible();
    const scene = await page.evaluate(() => {
      const rect = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      const lion = rect(".opening-lion"), kitten = rect(".opening-kitten"), envelope = rect(".envelope");
      const midpoint = (lion.left + lion.width / 2 + kitten.left + kitten.width / 2) / 2;
      return {
        horizontalOffset: Math.abs(envelope.left + envelope.width / 2 - midpoint),
        verticalOffset: Math.abs(envelope.top + envelope.height / 2 - (lion.top + lion.height / 2 + kitten.top + kitten.height / 2) / 2),
        captionGap: Math.min(lion.top, kitten.top) - rect(".opening-caption").bottom,
        pawsOffset: Math.abs(lion.bottom - kitten.bottom),
        left: lion.left, right: kitten.right,
        width: innerWidth,
        dialogWidth: document.querySelector(".opening")!.scrollWidth,
      };
    });
    expect(scene.horizontalOffset).toBeLessThan(13);
    expect(scene.verticalOffset).toBeLessThan(30);
    expect(scene.captionGap).toBeGreaterThan(16);
    expect(scene.pawsOffset).toBeLessThan(8);
    expect(scene.left).toBeGreaterThanOrEqual(0);
    expect(scene.right).toBeLessThanOrEqual(scene.width);
    expect(scene.dialogWidth).toBe(scene.width);
    if (viewport.width <= 767) {
      await expect(page.locator(".held-bouquet")).toHaveCount(2);
      await expect(page.locator(".held-balloon")).toHaveCount(6);
      const visibleBalloons = await page.locator(".held-balloon").evaluateAll(elements => elements.every(element => {
        const box = element.getBoundingClientRect();
        return box.left >= 0 && box.right <= innerWidth;
      }));
      expect(visibleBalloons).toBe(true);
      const layers = await page.evaluate(() => ({
        characters: Number(getComputedStyle(document.querySelector(".opening-character-backdrop")!).zIndex),
        envelope: Number(getComputedStyle(document.querySelector(".opening-stage")!).zIndex),
      }));
      expect(layers.characters).toBeGreaterThan(layers.envelope);
    }
    const open = page.getByRole("button", { name: "Відкрити запрошення", exact: true });
    await open.scrollIntoViewIfNeeded();
    const box = await open.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
    await open.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});

test("narrow scene opens by touching the centered envelope and reveals all card text", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  const envelope = page.getByRole("button", { name: "Відкрити конверт", exact: true });
  await expect(envelope).toBeEnabled({ timeout: 12000 });
  const before = await page.locator(".held-balloon-flight").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top));
  await envelope.click();
  await page.waitForTimeout(1100);
  const released = await page.locator(".held-balloon-flight").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top));
  expect(released.every((top, i) => top < before[i] - 10)).toBe(true);
  await page.waitForTimeout(750);
  const card = await page.evaluate(() => {
    const letter = document.querySelector<HTMLElement>(".envelope-letter")!;
    const bounds = letter.getBoundingClientRect();
    return {
      top: bounds.top,
      bottom: bounds.bottom,
      pocketTop: document.querySelector(".envelope-front")!.getBoundingClientRect().top,
      overflow: letter.scrollHeight > letter.clientHeight,
      blue: getComputedStyle(document.querySelector(".envelope-name-blue")!).color,
      pink: getComputedStyle(document.querySelector(".envelope-name-pink")!).color,
    };
  });
  expect(card.top).toBeGreaterThan(62);
  expect(card.bottom).toBeLessThan(card.pocketTop);
  expect(card.overflow).toBe(false);
  expect(card.blue).not.toBe(card.pink);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("closing composition stays centered with equal mobile page margins", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Пропустити", exact: true }).click();
    await page.locator(".closing-greeting").scrollIntoViewIfNeeded();
    const composition = await page.locator(".closing-greeting").evaluate(element => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: innerWidth - box.right, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(Math.abs(composition.left - composition.right)).toBeLessThan(2);
    expect(composition.overflow).toBe(false);
    await expect(page.locator(".greeting-toys")).toHaveCount(0);
    const bows = await page.locator(".closing-bow").evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: innerWidth - box.right, top: box.top, width: box.width, mirrored: getComputedStyle(element).transform.startsWith("matrix(-1") };
    }));
    expect(bows).toHaveLength(2);
    expect(Math.abs(bows[0].left - bows[1].right)).toBeLessThan(2);
    expect(Math.abs(bows[0].top - bows[1].top)).toBeLessThan(2);
    expect(Math.abs(bows[0].width - bows[1].width)).toBeLessThan(2);
    expect(bows.map(bow => bow.mirrored)).toEqual([false, true]);
    await page.locator(".letter-choices").scrollIntoViewIfNeeded();
    for (const index of [0, 1]) {
      await page.locator(".letter-choice").nth(index).click();
      const baselines = await page.locator(".choice-label strong").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().bottom));
      expect(Math.abs(baselines[0] - baselines[1])).toBeLessThan(2);
    }
  }
});
