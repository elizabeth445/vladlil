import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { CHARACTER_ANATOMY } from "../lib/character-anatomy";

async function enter(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Пропустити", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".character-play-lion .character-rig")).toHaveAttribute("data-art-ready", "true");
}

test("anatomy uses undistorted artwork, paired front paws and opaque shoulder attachments", async () => {
  for (const kind of ["lion", "kitten"] as const) {
    const rig = CHARACTER_ANATOMY[kind];
    const boxes = { body: rig.body, "head-open": rig.head, tail: rig.tail.box, "paw-rest": rig.frontLeft, "paw-wave-bent": rig.wave.box };
    for (const [name, rect] of Object.entries(boxes)) {
      const { width, height } = await sharp(`public/art/characters/${kind}/${name}.png`).metadata();
      expect(rect.width / rect.height, `${kind} ${name} aspect ratio`).toBeCloseTo(width! / height!, 7);
    }
    const centers = [rig.frontLeft, rig.frontRight].map(r => r.x + r.width / 2);
    expect((centers[0] + centers[1]) / 2).toBeCloseTo(rig.center, 6);
    expect(centers[1] - centers[0]).toBeGreaterThan(16);
    expect(rig.frontRight.x - rig.frontLeft.x - rig.frontLeft.width).toBeGreaterThan(1);
    for (const rect of [rig.frontLeft, rig.frontRight]) expect(rect.y + rect.height).toBe(rig.ground);
    const { data, info } = await sharp(`public/art/characters/${kind}/body.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (const shoulder of [rig.wave.shoulder, { x: centers[0], y: rig.frontLeft.y }, { x: centers[1], y: rig.frontRight.y }]) {
      const x = Math.round((shoulder.x - rig.body.x) / rig.body.width * info.width);
      const y = Math.round((shoulder.y - rig.body.y) / rig.body.height * info.height);
      expect(data[(y * info.width + x) * 4 + 3], `${kind} shoulder must be inside torso fur`).toBeGreaterThan(220);
    }
  }
});

test("both shoulder pivots stay inside the torso and planted paws stay grounded throughout the wave", async ({ page }) => {
  await enter(page);
  const greeting = page.locator(".closing-greeting");
  await greeting.scrollIntoViewIfNeeded();
  await expect(greeting.locator(".rig-kitten")).toHaveAttribute("data-art-ready", "true");
  await expect(greeting.locator(".rig-lion")).toHaveAttribute("data-wave-state", "idle");
  await greeting.focus();
  await page.keyboard.press("Enter");
  const samples = await greeting.evaluate(element => new Promise<{ angle: number; pivotDrift: number; footDrift: number; shoulderCovered: boolean }[]>(resolve => {
    const rigs = [...element.querySelectorAll<HTMLElement>(".character-rig")];
    const result = rigs.map(() => ({ angle: 0, pivotDrift: 0, footDrift: 0, shoulderCovered: true }));
    const start = performance.now();
    const sample = () => {
      rigs.forEach((rig, i) => {
        const stage = rig.querySelector<SVGSVGElement>(".rig-artwork")!;
        const joint = rig.querySelector<SVGGElement>(".rig-shoulder")!;
        const point = new DOMPoint(Number(joint.dataset.shoulderX), Number(joint.dataset.shoulderY));
        const expected = point.matrixTransform(stage.getScreenCTM()!);
        const actual = point.matrixTransform(joint.getScreenCTM()!);
        const matrix = joint.transform.baseVal.consolidate()!.matrix;
        result[i].angle = Math.max(result[i].angle, Math.abs(Math.atan2(matrix.b, matrix.a) * 180 / Math.PI));
        result[i].pivotDrift = Math.max(result[i].pivotDrift, Math.hypot(actual.x - expected.x, actual.y - expected.y));
        const chest = rig.querySelector<SVGGElement>(".rig-chest .rig-body-breath")!;
        const chestPoint = actual.matrixTransform(chest.getScreenCTM()!.inverse());
        const chestPath = rig.querySelector<SVGGeometryElement>("clipPath path")!;
        result[i].shoulderCovered &&= chestPath.isPointInFill(chestPoint);
        const ground = new DOMPoint(0, 96).matrixTransform(stage.getScreenCTM()!).y;
        const foot = rig.querySelector<SVGImageElement>(".rig-grounded-front image")!;
        const footPoint = new DOMPoint(foot.x.baseVal.value + foot.width.baseVal.value / 2, foot.y.baseVal.value + foot.height.baseVal.value).matrixTransform(foot.getScreenCTM()!);
        result[i].footDrift = Math.max(result[i].footDrift, Math.abs(footPoint.y - ground));
      });
      if (performance.now() - start < 2300) requestAnimationFrame(sample); else resolve(result);
    }; sample();
  }));
  for (const sample of samples) {
    expect(sample.angle).toBeGreaterThan(2.2);
    expect(sample.angle).toBeLessThanOrEqual(2.9);
    expect(sample.pivotDrift).toBeLessThan(.15);
    expect(sample.footDrift).toBeLessThan(.15);
    expect(sample.shoulderCovered).toBe(true);
  }
  await expect(greeting.locator("feDisplacementMap, .greeting-toys")).toHaveCount(0);
  await page.locator("#home").scrollIntoViewIfNeeded();
  await expect(greeting.locator(".rig-lion")).toHaveAttribute("data-idle-running", "false");
  await greeting.scrollIntoViewIfNeeded();
  await expect(greeting.locator(".rig-lion")).toHaveAttribute("data-wave-state", "waving");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(greeting.locator(".rig-lion")).toHaveAttribute("data-idle-running", "false");
  await greeting.click();
  await expect(greeting.locator(".rig-lion")).toHaveAttribute("data-wave-state", "idle");
  for (const shoulder of await greeting.locator(".rig-shoulder").all()) {
    expect(await shoulder.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).isIdentity)).toBe(true);
  }
});

test("hero has four planted front paws, smooth head movement and unchanged tap messages", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  const characters = page.locator(".hero-characters");
  await expect(characters.locator(".rig-shoulder")).toHaveCount(0);
  await expect(characters.locator(".rig-grounded-front")).toHaveCount(4);
  const motion = await characters.evaluate(element => new Promise<{ jump: number; angle: number; stableSources: boolean }>(resolve => {
    const heads = [...element.querySelectorAll<SVGGElement>(".rig-head-idle")];
    const images = [...element.querySelectorAll<SVGImageElement>(".rig-head > image")];
    const sources = images.map(image => image.href.baseVal);
    const previous = heads.map(head => head.getScreenCTM()!);
    let jump = 0, angle = 0, stableSources = true;
    const start = performance.now();
    const sample = () => {
      heads.forEach((head, i) => {
        const matrix = head.getScreenCTM()!;
        jump = Math.max(jump, Math.abs(matrix.e - previous[i].e), Math.abs(matrix.f - previous[i].f));
        angle = Math.max(angle, Math.abs(Math.atan2(matrix.b, matrix.a) * 180 / Math.PI));
        previous[i] = matrix;
      });
      stableSources &&= images.every((image, i) => image.href.baseVal === sources[i]);
      if (performance.now() - start < 3500) requestAnimationFrame(sample); else resolve({ jump, angle, stableSources });
    }; sample();
  }));
  expect(motion.angle).toBeGreaterThan(.1);
  expect(motion.jump).toBeLessThan(.6);
  expect(motion.stableSources).toBe(true);
  for (const name of ["Привітатися з левеням", "Погладити кошеня"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator(name.startsWith("Привітатися") ? ".character-play-lion .character-greeting" : ".character-play-kitten .character-greeting")).toBeVisible();
  }
});

test("a blink changes only the eyes, without shifting the head, ears, bow or body", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await enter(page);
  const greeting = page.locator(".closing-greeting");
  await greeting.scrollIntoViewIfNeeded();
  await expect(greeting.locator(".rig-kitten")).toHaveAttribute("data-art-ready", "true");
  const bounds = await greeting.boundingBox();
  const eyeRegions = await greeting.locator("[data-eye-radius-x]").evaluateAll(elements => elements.map(element => {
    const eye = element as SVGGElement;
    const rx = Number(eye.dataset.eyeRadiusX), ry = Number(eye.dataset.eyeRadiusY);
    const matrix = eye.getScreenCTM()!;
    const corners = [[-rx, -ry], [rx, -ry], [-rx, ry], [rx, ry]].map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix));
    return { left: Math.min(...corners.map(p => p.x)) - 6, right: Math.max(...corners.map(p => p.x)) + 6, top: Math.min(...corners.map(p => p.y)) - 6, bottom: Math.max(...corners.map(p => p.y)) + 6 };
  }));
  const before = await sharp(await greeting.screenshot()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  await greeting.locator(".rig-lid-motion, .rig-lash").evaluateAll(elements => elements.forEach(element => { (element as SVGElement).style.opacity = "1"; }));
  const after = await sharp(await greeting.screenshot()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(after.info.width).toBe(before.info.width);
  let changedOutsideEyes = 0, changedEyes = 0;
  for (let y = 0; y < before.info.height; y++) for (let x = 0; x < before.info.width; x++) {
    const offset = (y * before.info.width + x) * 4;
    const difference = Math.max(...[0, 1, 2].map(channel => Math.abs(before.data[offset + channel] - after.data[offset + channel])));
    if (difference < 8) continue;
    if (eyeRegions.some(r => x + bounds!.x >= r.left && x + bounds!.x <= r.right && y + bounds!.y >= r.top && y + bounds!.y <= r.bottom)) changedEyes++;
    else changedOutsideEyes++;
  }
  expect(changedEyes).toBeGreaterThan(100);
  expect(changedOutsideEyes).toBe(0);
});

test("the automatic wave waits for every character asset", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/paw-wave-bent.png", async route => { await gate; await route.continue(); });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Пропустити", exact: true }).click();
  const greeting = page.locator(".closing-greeting");
  await greeting.scrollIntoViewIfNeeded();
  await expect(greeting.locator(".rig-lion")).toHaveAttribute("data-art-ready", "false");
  await expect(greeting.locator(".rig-lion")).toHaveAttribute("data-wave-state", "idle");
  release();
  await expect(greeting.locator(".rig-lion")).toHaveAttribute("data-art-ready", "true");
  await expect(greeting.locator(".rig-lion")).toHaveAttribute("data-wave-state", "waving");
});
