type VideoFormat = "hevc" | "webm";
export type CharacterFormat = VideoFormat | "webp";
let support: Promise<CharacterFormat> | undefined;

/** Test decoded pixels, not just codec support: opaque VP9/HEVC is unsafe. */
async function hasAlpha(format: VideoFormat): Promise<boolean> {
  const video = document.createElement("video");
  video.muted = video.defaultMuted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Alpha probe timed out")), 2200);
      const settle = (error?: Error) => {
        clearTimeout(timer);
        video.onloadeddata = video.onerror = null;
        if (error) reject(error); else resolve();
      };
      video.onloadeddata = () => settle();
      video.onerror = () => settle(new Error("Unsupported alpha codec"));
      video.src = `/animations/alpha-probe.${format === "hevc" ? "mov" : "webm"}`;
      video.load();
    });
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 16;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return false;
    context.drawImage(video, 0, 0, 16, 16);
    return context.getImageData(3, 8, 1, 1).data[3] < 8 && context.getImageData(12, 8, 1, 1).data[3] > 247;
  } catch {
    return false;
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
  }
}

export function characterFormat(): Promise<CharacterFormat> {
  support ??= Promise.all([hasAlpha("hevc"), hasAlpha("webm")]).then(([hevc, webm]) => hevc ? "hevc" : webm ? "webm" : "webp");
  return support;
}
