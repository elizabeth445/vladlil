import { test, expect } from "@playwright/test";

test("original seated artwork stays level, clears the date and keeps greetings only in closing", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Пропустити", exact: true }).click();
    await page.locator(".hero-characters img").evaluateAll(elements => Promise.all(elements.map(e => (e as HTMLImageElement).decode())));
    await expect(page.locator("#home .closing-caption, #home button, .rig-shoulder")).toHaveCount(0);
    const geometry = await page.locator("#home").evaluate(element => {
      const date = element.querySelector(".hero-date")!.getBoundingClientRect();
      const images = [...element.querySelectorAll<HTMLImageElement>(".seated-character img")];
      const boxes = images.map(image => image.getBoundingClientRect());
      const feet = boxes.map((r, i) => r.top + r.height * (i === 0 ? .976 : 735 / 786));
      return {
        overlapsDate: boxes.some(r => r.left < date.right && r.right > date.left && r.top < date.bottom && r.bottom > date.top),
        footDifference: Math.abs(feet[0] - feet[1]),
        topDifference: Math.abs(boxes[0].top - boxes[1].top),
        static: images.every(image => getComputedStyle(image).transform === "none"),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(geometry.overlapsDate).toBe(false);
    expect(geometry.footDifference).toBeLessThan(3);
    expect(geometry.topDifference).toBeLessThan(9);
    expect(geometry.static).toBe(true);
    expect(geometry.overflow).toBe(false);
    const closing = page.locator(".closing-greeting");
    await closing.scrollIntoViewIfNeeded();
    await expect(closing.locator(".closing-caption")).toHaveText(["Радий вас бачити!", "Мур-р! До зустрічі!"]);
    await expect(closing.locator(".animated-together")).toHaveCount(1);
    await expect(closing.locator(".animated-together")).toHaveAttribute("data-state", "idle");
    for (const image of await closing.locator("img").all()) await expect(image).toHaveCSS("transform", "none");
  }
});
