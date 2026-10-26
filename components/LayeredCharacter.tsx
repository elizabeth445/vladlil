"use client";

import Image from "next/image";
import { forwardRef, useImperativeHandle, useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);
export type CharacterHandle = { wave: () => void };

// All parts share one square coordinate system. The shoulder root stays under
// the chest/head overlap; only the foreleg rotates, never the complete image.
const LayeredCharacter = forwardRef<CharacterHandle, {
  kind: "lion" | "kitten";
  className?: string;
  priority?: boolean;
  autoWave?: boolean;
}>(function LayeredCharacter({ kind, className = "", priority = false, autoWave = false }, ref) {
  const root = useRef<HTMLSpanElement>(null);
  const gesture = useRef<gsap.core.Timeline | null>(null);
  useImperativeHandle(ref, () => ({ wave: () => gesture.current?.restart() }), []);

  useGSAP(() => {
    const element = root.current!;
    const select = gsap.utils.selector(element);
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const idle = gsap.timeline({ paused: true, repeat: -1, yoyo: true, defaults: { ease: "sine.inOut", duration: kind === "lion" ? 3.2 : 3.6 } })
        .to(select(".rig-body-idle"), { scaleY: 1.008 }, 0)
        .to(select(".rig-head-idle"), { rotation: kind === "lion" ? 0.65 : -0.65, yPercent: -0.25 }, 0)
        .to(select(".rig-tail"), { rotation: kind === "lion" ? 2.5 : -2.5 }, 0);
      const blink = gsap.timeline({ paused: true, repeat: -1, repeatDelay: kind === "lion" ? 4.7 : 5.6 })
        .set(select(".rig-eyes-closed"), { opacity: 1 }, 1.5)
        .set(select(".rig-eyes-open"), { opacity: 0 }, 1.5)
        .set(select(".rig-eyes-open"), { opacity: 1 }, 1.64)
        .set(select(".rig-eyes-closed"), { opacity: 0 }, 1.64);
      const direction = kind === "lion" ? 1 : -1;
      const wave = gsap.timeline({
        paused: true,
        defaults: { ease: "sine.inOut" },
        onStart: () => { element.dataset.waveState = "waving"; },
        onComplete: () => { element.dataset.waveState = "idle"; },
      })
        .to(select(".rig-wave-joint"), { rotation: direction * -3, duration: 0.3 }, 0)
        .to(select(".rig-wave-joint"), { rotation: direction * 4, duration: 0.32, repeat: 3, yoyo: true }, 0.3)
        .to(select(".rig-wave-joint"), { rotation: 0, duration: 0.35 }, 1.58)
        .to(select(".rig-body-gesture"), { yPercent: -0.35, duration: 0.4, repeat: 1, yoyo: true }, 0.12)
        .to(select(".rig-head-gesture"), { rotation: direction * -0.65, duration: 0.5, repeat: 1, yoyo: true }, 0.12);
      gesture.current = wave;
      let visible = false;
      const sync = () => {
        const running = visible && !document.hidden && !element.closest("[inert]");
        element.dataset.idleRunning = String(running);
        idle.paused(!running);
        blink.paused(!running);
        if (!running) {
          wave.pause(0);
          element.dataset.waveState = "idle";
        }
      };
      const observer = new IntersectionObserver(([entry]) => {
        const entered = entry.isIntersecting && !visible;
        visible = entry.isIntersecting;
        sync();
        if (entered && autoWave && !element.closest("[inert]")) wave.restart();
      }, { threshold: 0.3 });
      observer.observe(element);
      // The opening dialog makes the page inert, without unmounting its parts.
      const inertObserver = new MutationObserver(sync);
      const invitation = element.closest(".invitation");
      if (invitation) inertObserver.observe(invitation, { attributes: true, attributeFilter: ["inert"] });
      document.addEventListener("visibilitychange", sync);
      return () => {
        observer.disconnect();
        inertObserver.disconnect();
        document.removeEventListener("visibilitychange", sync);
        gesture.current = null;
        element.dataset.waveState = "idle";
        element.dataset.idleRunning = "false";
      };
    });
    return () => mm.revert();
  }, { scope: root, dependencies: [kind, autoWave], revertOnUpdate: true });

  const part = (name: string, className = "") => <Image
    className={className}
    src={`/art/characters/${kind}/${name}.png`}
    alt="" width={480} height={480} unoptimized
    loading={priority ? "eager" : "lazy"}
    draggable={false}
  />;
  return <span ref={root} className={`character-rig rig-${kind} ${className}`} aria-hidden="true" data-wave-state="idle" data-idle-running="false">
    <span className="rig-part rig-tail">{part("tail")}</span>
    <span className="rig-part rig-body"><span className="rig-body-idle"><span className="rig-body-gesture">{part("body")}</span></span></span>
    <span className="rig-part rig-rest">{part("paw-rest")}</span>
    <span className="rig-part rig-wave"><span className="rig-wave-joint">{part("paw-wave")}</span></span>
    <span className="rig-part rig-head"><span className="rig-head-idle"><span className="rig-head-gesture">
      {part("head-open", "rig-eyes-open")}
      {part("head-closed", "rig-eyes-closed")}
    </span></span></span>
  </span>;
});
export default LayeredCharacter;
