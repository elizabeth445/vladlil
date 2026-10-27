"use client";

import { useEffect, useRef } from "react";
import { characterFormat, type CharacterFormat } from "@/lib/character-alpha";

const artwork = {
  lion: { width: 800, height: 624, duration: 10000, name: "левеняти з подарунком" },
  kitten: { width: 658, height: 472, duration: 10000, name: "кошеняти з подарунком" },
  together: { width: 896, height: 512, duration: 8000, name: "обіймів левеняти й кошеняти" },
};

type Props = {
  kind: keyof typeof artwork;
  loop?: boolean;
  enabled?: boolean;
  autoPlay?: boolean;
  initialFrame?: "first" | "last";
  format?: "auto" | "webp";
};

/** All formats use the same fixed crop, with no transforms or CSS fake motion.
 * Only a codec that passes an actual pixel-alpha test may replace the poster. */
export default function AnimatedCharacter({ kind, loop = false, enabled = true, autoPlay = true, initialFrame = "first", format = "auto" }: Props) {
  const root = useRef<HTMLButtonElement>(null);
  const poster = useRef<HTMLImageElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const animation = useRef<HTMLImageElement>(null);
  const { width, height, duration, name } = artwork[kind];
  const prefix = `/animations/${kind}`;

  useEffect(() => {
    const button = root.current!, still = poster.current!, movie = video.current!, image = animation.current!;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const abort = new AbortController();
    let alive = true, visible = false, played = false, playing = false, manual = false;
    let prepared: Promise<CharacterFormat> | undefined, blob: Blob | undefined, objectUrl: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined, frameCallback: number | undefined;
    let generation = 0;
    let selected: CharacterFormat = "webp";
    const state = (value: string) => {
      button.dataset.state = value;
      button.setAttribute("aria-busy", String(value === "loading"));
    };
    const show = (element: HTMLElement) => {
      // An atomic visibility exchange: no empty/black frame or opacity blend.
      for (const layer of [still, movie, image]) layer.style.visibility = layer === element ? "visible" : "hidden";
    };
    const releaseUrl = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = undefined;
    };
    const fallback = async () => {
      blob ??= await fetch(`${prefix}.webp`, { signal: abort.signal }).then(response => {
        if (!response.ok) throw new Error("Animation unavailable");
        return response.blob();
      });
      return "webp" as const;
    };
    const prepare = () => prepared ??= (async () => {
      selected = format === "webp" ? "webp" : await characterFormat();
      if (!alive) return selected;
      if (selected === "webp") await fallback();
      else {
        movie.src = `${prefix}.${selected === "hevc" ? "mov" : "webm"}`;
        movie.preload = "auto";
        movie.load();
      }
      if (alive) button.dataset.format = selected;
      return selected;
    })();
    const ended = () => {
      if (!alive) return;
      playing = false;
      state("ended");
      // Both native video and the one-shot WebP retain their actual last frame.
      if (loop && visible) void play(manual);
    };
    const playWebp = async (run: number) => {
      await fallback();
      if (!alive || run !== generation) return;
      releaseUrl();
      objectUrl = URL.createObjectURL(blob!);
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Cannot decode animation"));
        image.src = objectUrl!;
      });
      if (!alive || run !== generation) return;
      show(image);
      state("playing");
      timer = setTimeout(ended, duration);
    };
    const play = async (byHand: boolean) => {
      if (!enabled || !alive || playing || (!byHand && motion.matches)) return;
      const run = ++generation;
      playing = true; manual = byHand; played = true;
      state("loading");
      clearTimeout(timer);
      try {
        await prepare();
        if (!alive || run !== generation) return;
        if (selected === "webp") await playWebp(run);
        else {
          movie.currentTime = 0;
          movie.muted = movie.defaultMuted = true;
          // Muted inline playback is independent of the invitation's music.
          await movie.play();
          if (!alive || run !== generation) return;
          const reveal = () => { if (alive && playing && run === generation) { show(movie); state("playing"); } };
          if ("requestVideoFrameCallback" in movie) frameCallback = movie.requestVideoFrameCallback(reveal);
          else reveal();
        }
      } catch {
        if (!alive || run !== generation) return;
        try {
          movie.pause();
          selected = "webp";
          button.dataset.format = selected;
          await playWebp(run);
        } catch {
          if (alive) { playing = false; played = false; state("error"); show(still); }
        }
      }
    };
    const startAutomatically = () => {
      if (enabled && autoPlay && visible && !played && !motion.matches) void play(false);
    };
    const near = new IntersectionObserver(entries => {
      if (enabled && entries.some(entry => entry.isIntersecting)) {
        // No heavy media is requested until this scene is close to the viewport.
        void prepare().catch(() => { prepared = undefined; });
        near.disconnect();
      }
    }, { rootMargin: "240px 0px" });
    const observer = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .5);
      startAutomatically();
      if (visible && loop && played && !playing && !motion.matches) void play(false);
    }, { threshold: [0, .5] });
    const click = () => { void play(true); };
    const hover = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && played && !playing) void play(true);
    };
    const preference = () => {
      if (motion.matches && playing && !manual) {
        generation++; clearTimeout(timer);
        movie.pause(); playing = false; state("idle"); show(still);
      } else startAutomatically();
    };
    const videoError = () => {
      if (alive && playing && selected !== "webp" && button.dataset.state === "playing") {
        selected = "webp"; button.dataset.format = selected;
        void playWebp(generation).catch(() => { if (alive) { playing = false; state("error"); show(still); } });
      }
    };
    show(still); state("idle");
    near.observe(button); observer.observe(button);
    button.addEventListener("click", click);
    button.addEventListener("pointerenter", hover);
    movie.addEventListener("ended", ended);
    movie.addEventListener("error", videoError);
    motion.addEventListener("change", preference);
    return () => {
      alive = false; generation++; abort.abort(); clearTimeout(timer);
      near.disconnect(); observer.disconnect();
      button.removeEventListener("click", click);
      button.removeEventListener("pointerenter", hover);
      movie.removeEventListener("ended", ended);
      movie.removeEventListener("error", videoError);
      motion.removeEventListener("change", preference);
      if (frameCallback !== undefined) movie.cancelVideoFrameCallback(frameCallback);
      movie.pause(); movie.removeAttribute("src"); movie.load();
      image.onload = image.onerror = null;
      image.removeAttribute("src"); releaseUrl();
    };
  }, [autoPlay, duration, enabled, format, initialFrame, kind, loop, prefix]);

  return <button ref={root} type="button" className={`animated-character animated-${kind}`} style={{ aspectRatio: `${width} / ${height}` }} aria-label={`Відтворити анімацію ${name}`} data-kind={kind} data-state="idle">
    {/* Native images preserve animated WebP and its alpha; Next Image must not re-encode them. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img ref={poster} src={`${prefix}-${initialFrame}.webp`} width={width} height={height} alt="" loading="lazy" decoding="async" />
    <video ref={video} width={width} height={height} muted playsInline preload="none" disablePictureInPicture disableRemotePlayback aria-hidden="true" />
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img ref={animation} width={width} height={height} alt="" aria-hidden="true" />
  </button>;
}
