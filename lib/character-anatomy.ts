export type CharacterKind = "lion" | "kitten";
export type Point = Readonly<{ x: number; y: number }>;
export type ArtBox = Readonly<{ x: number; y: number; width: number; height: number }>;
export type Eye = Readonly<{ cx: number; cy: number; rx: number; ry: number; angle: number }>;

// One 100 × 100 stage, one ground line, actual PNG aspect ratios. Front legs
// are placed from their shoulder/foot columns, not unrelated CSS percentages.
const GROUND = 96;
function box(x: number, y: number, width: number, sourceWidth: number, sourceHeight: number): ArtBox {
  return { x, y, width, height: width * sourceHeight / sourceWidth };
}
function anchoredBox(anchor: Point, sourceAnchor: Point, width: number, sw: number, sh: number): ArtBox {
  const height = width * sh / sw;
  return { x: anchor.x - sourceAnchor.x * width, y: anchor.y - sourceAnchor.y * height, width, height };
}
function groundedLeg(centerX: number, height: number, sw: number): ArtBox {
  const width = height * sw / 240;
  return { x: centerX - width / 2, y: GROUND - height, width, height };
}

const lionShoulder = { x: 60.5, y: 67 };
const kittenShoulder = { x: 41.5, y: 66 };
export const CHARACTER_ANATOMY = {
  lion: {
    center: 52,
    ground: GROUND,
    body: box(23.5, GROUND - 57 * 320 / 400, 57, 400, 320),
    bellyCut: "M47 101C48 95 49.5 91 52 91C54.5 91 57 95 58 101Z",
    chest: "M43 53Q52 50 62 54L63 66Q65 73 63 82Q61 90 55 94L48 94Q41 89 40 81Q38 73 41 65Z",
    head: box(20.5, 1.8, 62, 403, 448),
    headSource: { width: 403, height: 448 },
    neck: { x: 52, y: 65 },
    frontLeft: groundedLeg(43.5, 29, 127),
    frontRight: groundedLeg(60.5, 29, 127),
    // The inner paw waves, away from the tail; the opposite paw is grounded.
    wave: { side: "right", shoulder: lionShoulder, box: anchoredBox(lionShoulder, { x: .12, y: .18 }, 29, 360, 293), mirror: true, direction: -1 },
    tail: { box: anchoredBox({ x: 31, y: 89 }, { x: .8, y: .93 }, 24, 147, 240), root: { x: 31, y: 89 }, restAngle: -6 },
    eyes: [
      { cx: 168, cy: 241, rx: 35, ry: 32, angle: -12 },
      { cx: 288, cy: 213, rx: 30, ry: 33, angle: -12 },
    ] satisfies Eye[],
    eyelid: { texture: { x: 212, y: 189, width: 38, height: 38 }, lash: "#65452e" },
  },
  kitten: {
    center: 50,
    ground: GROUND,
    body: box(23, GROUND - 54 * 320 / 337, 54, 337, 320),
    bellyCut: "M41 101C42 94 45 89 50 89C55 89 59 94 60 101Z",
    chest: "M42 49Q50 45 59 49L61 65Q64 75 61 85Q58 93 50 95Q41 93 38 85Q36 76 39 65Z",
    head: box(15.5, 10.7, 69, 549, 448),
    headSource: { width: 549, height: 448 },
    neck: { x: 50, y: 64 },
    frontLeft: groundedLeg(41.5, 30, 117),
    frontRight: groundedLeg(58.5, 30, 117),
    wave: { side: "left", shoulder: kittenShoulder, box: anchoredBox(kittenShoulder, { x: .88, y: .18 }, 29, 360, 300), mirror: true, direction: 1 },
    tail: { box: anchoredBox({ x: 70, y: 89 }, { x: .18, y: .9 }, 29, 207, 240), root: { x: 70, y: 89 }, restAngle: 0 },
    eyes: [
      { cx: 159, cy: 270, rx: 41, ry: 39, angle: 14 },
      { cx: 306, cy: 300, rx: 43, ry: 39, angle: 14 },
    ] satisfies Eye[],
    eyelid: { texture: { x: 220, y: 233, width: 30, height: 30 }, lash: "#76665a" },
  },
} as const;
