import { test, expect } from "@playwright/test";

test("shared closing scene stays centered, clears captions and date, and respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Пропустити", exact: true }).click();
    const scene = page.locator(".closing .animated-together");
    await scene.scrollIntoViewIfNeeded();
    await expect(scene).toHaveAttribute("data-state", "idle");
    await scene.locator("img").first().evaluate(element => (element as HTMLImageElement).decode());
    const geometry = await scene.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const date = document.querySelector(".closing-date")!.getBoundingClientRect();
      const captions = [...document.querySelectorAll(".closing-caption")].map(e => e.getBoundingClientRect());
      return { centered: Math.abs(rect.left - (innerWidth - rect.right)), clearsDate: rect.bottom <= date.top,
        clearsCaptions: captions.every(c => c.bottom <= rect.top), overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(geometry.centered).toBeLessThan(2);
    expect(geometry.clearsDate && geometry.clearsCaptions).toBe(true);
    expect(geometry.overflow).toBe(false);
    await page.screenshot({ path: `output/playwright/closing-together-${width}.png` });
  }
  await page.locator(".closing .animated-together").click();
  await expect(page.locator(".closing .animated-together")).toHaveAttribute("data-state", "playing");
});

test("hug and wave plays eight seconds once, holds its frame and replays without scroll restarts", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Пропустити", exact: true }).click();
  const scene = page.locator(".closing .animated-together");
  await scene.scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute("data-state", "playing");
  const before = await scene.boundingBox();
  const documentTop = await scene.evaluate(e => e.getBoundingClientRect().top + scrollY);
  expect(await scene.locator("video").evaluate(v => ({ duration: (v as HTMLVideoElement).duration, muted: (v as HTMLVideoElement).muted, controls: (v as HTMLVideoElement).controls, inline: (v as HTMLVideoElement).playsInline }))).toEqual({ duration: 8, muted: true, controls: false, inline: true });
  await expect(scene).toHaveAttribute("data-state", "ended", { timeout: 12000 });
  await page.locator(".closing h2").scrollIntoViewIfNeeded();
  await scene.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await expect(scene).toHaveAttribute("data-state", "ended");
  const after = await scene.boundingBox();
  expect(after?.width).toBe(before?.width);
  expect(after?.height).toBe(before?.height);
  expect(await scene.evaluate(e => e.getBoundingClientRect().top + scrollY)).toBeCloseTo(documentTop, 1);
  await page.mouse.move(0, 0); await scene.hover();
  await expect(scene).toHaveAttribute("data-state", "playing");
  expect(await scene.locator("video").evaluate(v => (v as HTMLVideoElement).currentTime)).toBeLessThan(2);
});

test("joint animation has decoded alpha through hugs and waves on all backgrounds", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/animation-check");
  await page.getByRole("button", { name: "Обійми та привітання", exact: true }).click();
  await page.getByRole("button", { name: "Відтворити", exact: true }).click();
  const scene = page.locator(".animated-together");
  await scene.scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute("data-state", "playing");
  for (const [i, background] of ["Білий", "Чорний", "Рожевий", "Блакитний", "Градієнт", "Фото"].entries()) {
    await page.getByRole("button", { name: background, exact: true }).click();
    const alpha = await scene.locator("video").evaluate(async (element, time) => {
      const video = element as HTMLVideoElement; video.pause();
      await new Promise<void>(resolve => { video.addEventListener("seeked", () => resolve(), { once: true }); video.currentTime = time; });
      const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const context = canvas.getContext("2d")!; context.drawImage(video, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let zero = 0, opaque = 0, partial = 0;
      for (let p = 3; p < data.length; p += 4) { if (data[p] === 0) zero++; else if (data[p] > 247) opaque++; else partial++; }
      return { zero, opaque, partial };
    }, .1 + i * 1.55);
    expect(alpha.zero).toBeGreaterThan(20000); expect(alpha.opaque).toBeGreaterThan(20000); expect(alpha.partial).toBeGreaterThan(100);
    await page.screenshot({ path: `output/playwright/together-background-${i}.png` });
  }
});

test("joint WebP fallback completes at eight seconds and supports manual replay", async ({ page }) => {
  await page.goto("/animation-check");
  await page.getByRole("button", { name: "Обійми та привітання", exact: true }).click();
  await page.getByRole("checkbox", { name: "Резервний WebP" }).check();
  await page.getByRole("button", { name: "Відтворити", exact: true }).click();
  const scene = page.locator(".animated-together");
  await scene.scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute("data-format", "webp");
  await expect(scene).toHaveAttribute("data-state", "playing");
  await expect(scene).toHaveAttribute("data-state", "ended", { timeout: 10000 });
  expect(await scene.locator("img").last().evaluate(element => {
    const image = element as HTMLImageElement, canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d")!; ctx.drawImage(image, 0, 0); return ctx.getImageData(0, 0, 1, 1).data[3];
  })).toBe(0);
  await scene.focus(); await page.keyboard.press("Enter");
  await expect(scene).toHaveAttribute("data-state", "playing");
});
