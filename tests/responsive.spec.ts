import { test, expect } from "@playwright/test";

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
  await envelope.click();
  await page.waitForTimeout(1850);
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
