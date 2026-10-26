"use client";

import Image from "next/image";
import { forwardRef, useImperativeHandle, useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);
export type CharacterHandle = { wave: () => void };

// The wave foreleg folds at the elbow. Its upper/inner shoulder root overlaps
// the chest below the head; the resting front legs stay planted in the hero.
const LayeredCharacter = forwardRef<CharacterHandle, {
  kind: "lion" | "kitten";
  className?: string;
  priority?: boolean;
  autoWave?: boolean;
}>(function LayeredCharacter({ kind, className = "", priority = false, autoWave = false }, ref) {
  const root = useRef<HTMLSpanElement>(null);
  const gesture = useRef<gsap.core.Timeline | null>(null);
  useImperativeHandle(ref, () => ({ wave: () => {
    const image = root.current?.querySelector<HTMLImageElement>(".rig-wave img");
    if (image?.complete && image.naturalWidth && !gesture.current?.isActive()) gesture.current?.restart();
  } }), []);

  useGSAP(() => {
    const element = root.current!;
    const select = gsap.utils.selector(element);
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const direction = kind === "lion" ? 1 : -1;
      const idle = gsap.timeline({ paused: true, repeat: -1, yoyo: true, defaults: { ease: "sine.inOut", duration: 3.8 } })
        .to(select(".rig-body-idle"), { scaleY: 1.004 }, 0)
        .to(select(".rig-tail"), { rotation: direction * 1.8 }, 0);
      // Keep the same head image throughout. Swapping full-head eye states
      // changed the silhouette and caused the visible kitten flicker.
      const glance = !autoWave ? gsap.timeline({ paused: true, repeat: -1, repeatDelay: 5.5 })
        .to(select(".rig-head-idle"), { xPercent: direction * 1.1, rotationY: direction * 7, rotation: direction * 0.65, duration: 1.6, ease: "sine.inOut" }, 0.4)
        .to(select(".rig-head-idle"), { xPercent: 0, rotationY: 0, rotation: 0, duration: 1.6, ease: "sine.inOut" }, 3.4) : null;
      const wave = autoWave ? gsap.timeline({
        paused: true,
        defaults: { ease: "sine.inOut" },
        onStart: () => { element.dataset.waveState = "waving"; },
        onComplete: () => { element.dataset.waveState = "idle"; },
      })
        .to(select(".rig-wave-joint"), { rotation: direction * -2, duration: 0.4 }, 0)
        .to(select(".rig-wave-joint"), { rotation: direction * 3, duration: 0.4, repeat: 3, yoyo: true }, 0.4)
        .to(select(".rig-wave-joint"), { rotation: 0, duration: 0.45 }, 2)
        .to(select(".rig-head-gesture"), { rotation: direction * -0.3, duration: 0.7, repeat: 1, yoyo: true }, 0.15) : null;
      gesture.current = wave;
      let visible = false;
      const waveImage = element.querySelector<HTMLImageElement>(".rig-wave img");
      const greetWhenReady = () => {
        if (visible && !document.hidden && !element.closest("[inert]") && waveImage?.complete && waveImage.naturalWidth && !wave?.isActive()) wave?.restart();
      };
      waveImage?.addEventListener("load", greetWhenReady);
      const sync = () => {
        const running = visible && !document.hidden && !element.closest("[inert]");
        element.dataset.idleRunning = String(running);
        idle.paused(!running);
        glance?.paused(!running);
        // Pause at the current pose instead of snapping back at a viewport edge.
        if (!running) wave?.pause();
        else if (wave && wave.progress() > 0 && wave.progress() < 1) wave.resume();
        else if (running && wave?.progress() === 0) greetWhenReady();
      };
      const observer = new IntersectionObserver(([entry]) => {
        const wasVisible = visible;
        if (entry.intersectionRatio >= 0.3) visible = true;
        else if (entry.intersectionRatio < 0.12) visible = false;
        sync();
        if (visible && !wasVisible) greetWhenReady();
      }, { threshold: [0, 0.12, 0.3] });
      observer.observe(element);
      const inertObserver = new MutationObserver(sync);
      const invitation = element.closest(".invitation");
      if (invitation) inertObserver.observe(invitation, { attributes: true, attributeFilter: ["inert"] });
      document.addEventListener("visibilitychange", sync);
      return () => {
        observer.disconnect();
        waveImage?.removeEventListener("load", greetWhenReady);
        inertObserver.disconnect();
        document.removeEventListener("visibilitychange", sync);
        gesture.current = null;
        element.dataset.waveState = "idle";
        element.dataset.idleRunning = "false";
      };
    });
    return () => mm.revert();
  }, { scope: root, dependencies: [kind, autoWave], revertOnUpdate: true });

  const part = (name: string) => <Image
    src={`/art/characters/${kind}/${name}.png`}
    alt="" width={480} height={480} unoptimized
    loading={priority || name === "paw-wave-bent" ? "eager" : "lazy"} draggable={false}
  />;
  return <span ref={root} className={`character-rig rig-${kind} ${className}`} aria-hidden="true" data-character-scene={autoWave ? "closing" : "hero"} data-wave-state="idle" data-idle-running="false">
    <span className="rig-part rig-tail">{part("tail")}</span>
    <span className="rig-part rig-body"><span className="rig-body-idle">{part("body")}</span></span>
    <span className="rig-part rig-rest">{part("paw-rest")}</span>
    {autoWave
      ? <span className="rig-part rig-wave"><span className="rig-wave-joint">{part("paw-wave-bent")}</span></span>
      : <span className="rig-part rig-front-near">{part("paw-rest")}</span>}
    <span className="rig-part rig-head"><span className="rig-head-idle"><span className="rig-head-gesture">
      {part("head-open")}
    </span></span></span>
  </span>;
});
export default LayeredCharacter;
