import { test, expect } from "@playwright/test";

const names = ["Відтворити анімацію левеняти з подарунком", "Відтворити анімацію кошеняти з подарунком"];

test("transparent stories lazy-load, stay separate from text and retain a stable responsive box", async ({ page }) => {
  const media: string[] = [];
  page.on("request", request => { if (/\/animations\/(lion|kitten)\.(mov|webm|webp)$/.test(request.url())) media.push(request.url()); });
  await page.goto("/");
  await page.getByRole("button", { name: "Пропустити", exact: true }).click();
  expect(media).toHaveLength(0);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const kind of ["blue", "pink"]) {
      const story = page.locator(`.story-${kind}`);
      await story.scrollIntoViewIfNeeded();
      const geometry = await story.evaluate(element => {
        const media = element.querySelector(".animated-character")!.getBoundingClientRect();
        const copy = element.querySelector(".story-copy")!.getBoundingClientRect();
        return { collision: media.left < copy.right && media.right > copy.left && media.top < copy.bottom && media.bottom > copy.top, width: media.width, height: media.height };
      });
      expect(geometry.collision).toBe(false);
      expect(geometry.width).toBeGreaterThan(100);
      await expect(story.locator(".story-gift, .watercolor-wash, .story-balloon, .character")).toHaveCount(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: `output/playwright/animated-stories-${width}.png` });
  }
});

test("native alpha survives seeking, any background and the opening of both gifts", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/animation-check");
  await page.getByRole("button", { name: "Відтворити", exact: true }).click();
  for (const name of names) await expect(page.getByRole("button", { name })).toHaveAttribute("data-state", "playing");
  const controls = await page.locator(".animated-character video").evaluateAll(videos => videos.map(v => ({ muted: (v as HTMLVideoElement).muted, inline: (v as HTMLVideoElement).playsInline, controls: (v as HTMLVideoElement).controls })));
  expect(controls.every(v => v.muted && v.inline && !v.controls)).toBe(true);
  for (const [i, background] of ["Білий", "Чорний", "Рожевий", "Блакитний", "Градієнт", "Фото"].entries()) {
    await page.getByRole("button", { name: background, exact: true }).click();
    const transparency = await page.locator(".animated-character video").evaluateAll(async (elements, time) => Promise.all(elements.map(async element => {
      const video = element as HTMLVideoElement;
      video.pause();
      await new Promise<void>(resolve => { video.addEventListener("seeked", () => resolve(), { once: true }); video.currentTime = time; });
      const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const context = canvas.getContext("2d")!; context.drawImage(video, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let zero = 0, opaque = 0, partial = 0;
      for (let p = 3; p < data.length; p += 4) { if (data[p] === 0) zero++; else if (data[p] > 247) opaque++; else partial++; }
      return { zero: zero / (data.length / 4), opaque: opaque / (data.length / 4), partial };
    })), .1 + i * 1.8);
    for (const alpha of transparency) { expect(alpha.zero).toBeGreaterThan(.3); expect(alpha.opaque).toBeGreaterThan(.15); expect(alpha.partial).toBeGreaterThan(100); }
    await page.screenshot({ path: `output/playwright/animation-alpha-background-${i}.png` });
  }
});

test("one-shot animation holds its last frame and replays on a fresh hover", async ({ page }) => {
  await page.goto("/animation-check");
  await page.getByRole("button", { name: "Відтворити", exact: true }).click();
  const lion = page.getByRole("button", { name: names[0] });
  await expect(lion).toHaveAttribute("data-state", "ended", { timeout: 15000 });
  const time = await lion.locator("video").evaluate(e => (e as HTMLVideoElement).currentTime);
  await page.waitForTimeout(500);
  await expect(lion).toHaveAttribute("data-state", "ended");
  expect(await lion.locator("video").evaluate(e => (e as HTMLVideoElement).currentTime)).toBeCloseTo(time, 1);
  await page.mouse.move(0, 0);
  await lion.hover();
  await expect(lion).toHaveAttribute("data-state", "playing");
  expect(await lion.locator("video").evaluate(e => (e as HTMLVideoElement).currentTime)).toBeLessThan(2);
});

test("reduced motion keeps the poster, supports manual playback and clears automatic movement", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/animation-check");
  await page.getByRole("button", { name: "Відтворити", exact: true }).click();
  const lion = page.getByRole("button", { name: names[0] });
  await page.waitForTimeout(600);
  await expect(lion).toHaveAttribute("data-state", "idle");
  await lion.click();
  await expect(lion).toHaveAttribute("data-state", "playing");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Відтворити", exact: true }).click();
  await expect(page.getByRole("button", { name: names[0] })).toHaveAttribute("data-state", "playing");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByRole("button", { name: names[0] })).toHaveAttribute("data-state", "idle");
});

test("transparent WebP fallback completes once and keyboard replays it", async ({ page }) => {
  await page.goto("/animation-check");
  await page.getByRole("checkbox", { name: "Резервний WebP" }).check();
  await page.getByRole("button", { name: "Відтворити", exact: true }).click();
  const kitten = page.getByRole("button", { name: names[1] });
  await kitten.scrollIntoViewIfNeeded();
  await expect(kitten).toHaveAttribute("data-format", "webp");
  await expect(kitten).toHaveAttribute("data-state", "playing");
  const alpha = await kitten.locator("img").last().evaluate(element => {
    const image = element as HTMLImageElement, canvas = document.createElement("canvas");canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const context = canvas.getContext("2d")!;context.drawImage(image,0,0);
    return context.getImageData(0,0,1,1).data[3];
  });
  expect(alpha).toBe(0);
  await expect(kitten).toHaveAttribute("data-state", "ended", { timeout: 13000 });
  await kitten.focus();await page.keyboard.press("Enter");
  await expect(kitten).toHaveAttribute("data-state", "playing");
});

test("loop mode can be enabled without changing the scene dimensions", async ({ page }) => {
  await page.goto("/animation-check");
  await page.getByRole("checkbox", { name: "Повторювати" }).check();
  await page.getByRole("button", { name: "Відтворити", exact: true }).click();
  const lion = page.getByRole("button", { name: names[0] });
  await expect(lion).toHaveAttribute("data-state", "playing");
  const before = await lion.boundingBox();
  await page.waitForTimeout(10700);
  await expect(lion).toHaveAttribute("data-state", "playing");
  expect(await lion.boundingBox()).toEqual(before);
  expect(await lion.locator("video").evaluate(e => (e as HTMLVideoElement).currentTime)).toBeLessThan(3);
});

test("codec detection requires real alpha, selects VP9 and rejects an opaque VP9 decoder", async ({ page }) => {
  await page.route("**/animations/alpha-probe.mov", route => route.abort());
  await page.goto("/animation-check");
  await page.getByRole("button", { name: "Відтворити", exact: true }).click();
  let lion = page.getByRole("button", { name: names[0] });
  await expect(lion).toHaveAttribute("data-format", "webm");
  await expect(lion).toHaveAttribute("data-state", "playing");
  expect(await lion.locator("video").evaluate(element => {
    const video = element as HTMLVideoElement, canvas = document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const context = canvas.getContext("2d")!; context.drawImage(video, 0, 0);
    return context.getImageData(0, 0, 1, 1).data[3];
  })).toBe(0);
  await page.route("**/animations/alpha-probe.webm", route => route.fulfill({ path: "tests/fixtures/opaque-codec-probe.webm", contentType: "video/webm" }));
  await page.goto("/animation-check");
  await page.getByRole("button", { name: "Відтворити", exact: true }).click();
  lion = page.getByRole("button", { name: names[0] });
  await expect(lion).toHaveAttribute("data-format", "webp");
  await expect(lion).toHaveAttribute("data-state", "playing");
});
