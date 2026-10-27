"use client";

import { useRef, type RefObject } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { CHARACTER_ANATOMY, type CharacterKind } from "@/lib/character-anatomy";

gsap.registerPlugin(useGSAP);
export type CharacterHandle = { wave: () => void };

export function useCharacterMotion(root: RefObject<HTMLSpanElement | null>, kind: CharacterKind, autoWave: boolean, priority: boolean) {
  const controller = useRef<CharacterHandle | null>(null);
  useGSAP(() => {
    const element = root.current!;
    const anatomy = CHARACTER_ANATOMY[kind];
    const select = gsap.utils.selector(element);
    let alive = true, ready = false;
    let syncReady = () => {};
    const paths = ["body", "head-open", "paw-rest", "tail", ...(autoWave ? ["paw-wave-bent"] : [])];
    const loaders = paths.map(part => {
      const image = new window.Image();
      image.fetchPriority = priority && ["head-open", "body"].includes(part) ? "high" : "auto";
      const promise = new Promise<void>((resolve, reject) => {
        image.onload = () => { void image.decode().then(resolve, reject); };
        image.onerror = reject;
      });
      image.src = `/art/characters/${kind}/${part}.png`;
      return { image, promise };
    });
    void Promise.all(loaders.map(loader => loader.promise)).then(() => {
      if (!alive) return;
      ready = true;
      element.dataset.artReady = "true";
      syncReady();
    }).catch(() => { if (alive) element.dataset.artReady = "error"; });

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const groundOrigin = `${anatomy.center} ${anatomy.ground}`;
      const neckOrigin = `${anatomy.neck.x} ${anatomy.neck.y}`;
      gsap.set(select(".rig-body-breath, .rig-body-compensation"), { svgOrigin: groundOrigin });
      gsap.set(select(".rig-head-idle, .rig-head-gesture"), { svgOrigin: neckOrigin });
      gsap.set(select(".rig-tail"), { svgOrigin: `${anatomy.tail.root.x} ${anatomy.tail.root.y}`, rotation: 0 });
      const idle = gsap.timeline({ paused: true, repeat: -1, yoyo: true, defaults: { duration: 3.6, ease: "sine.inOut" } })
        .to(select(".rig-body-breath"), { scaleY: 1.003 }, 0)
        .to(select(".rig-tail"), { rotation: kind === "lion" ? 1.3 : -1.3 }, 0)
        .to(select(".rig-head-idle"), { rotation: kind === "lion" ? .45 : -.45 }, 0);
      const lids = select(".rig-lid-motion");
      lids.forEach((lid: Element) => gsap.set(lid, { scaleY: 0, opacity: 1, svgOrigin: `0 ${lid.getAttribute("data-eye-top")}` }));
      const blink = gsap.timeline({ paused: true, repeat: -1, repeatDelay: kind === "lion" ? 5.3 : 6.4,
        onRepeat: () => { element.dataset.blinkState = "open"; } })
        .set(element, { attr: { "data-blink-state": "closed" } }, kind === "lion" ? 1.8 : 2.7)
        .to(lids, { scaleY: 1, duration: .09, ease: "power1.in" }, "<")
        .to(select(".rig-lash"), { opacity: 1, duration: .04 }, ">-.03")
        .to(lids, { scaleY: 0, duration: .13, ease: "power1.out" }, ">.035")
        .to(select(".rig-lash"), { opacity: 0, duration: .06 }, "<")
        .set(element, { attr: { "data-blink-state": "open" } });
      const wave = autoWave ? gsap.timeline({ paused: true, defaults: { ease: "sine.inOut" },
        onStart: () => { element.dataset.waveState = "waving"; },
        onComplete: () => { element.dataset.waveState = "idle"; },
      }) : null;
      if (wave) {
        gsap.set(select(".rig-shoulder"), { svgOrigin: `${anatomy.wave.shoulder.x} ${anatomy.wave.shoulder.y}` });
        wave.to(select(".rig-shoulder"), { rotation: anatomy.wave.direction * -1.8, duration: .35 }, 0)
          .to(select(".rig-shoulder"), { rotation: anatomy.wave.direction * 2.8, duration: .36, repeat: 3, yoyo: true }, .35)
          .to(select(".rig-shoulder"), { rotation: 0, duration: .4 }, 1.79)
          .to(select(".rig-body-compensation"), { scaleY: 1.0015, duration: .65, repeat: 1, yoyo: true }, .1)
          .to(select(".rig-head-gesture"), { rotation: -anatomy.wave.direction * .2, duration: .65, repeat: 1, yoyo: true }, .1);
      }
      let visible = false;
      const running = () => ready && visible && !document.hidden && !element.closest("[inert]");
      const greet = () => { if (running() && wave && !wave.isActive()) wave.restart(); };
      controller.current = { wave: greet };
      const sync = () => {
        const active = Boolean(running());
        element.dataset.idleRunning = String(active);
        idle.paused(!active);
        blink.paused(!active);
        if (!active) wave?.pause();
        else if (wave && wave.progress() > 0 && wave.progress() < 1) wave.resume();
        else if (wave?.progress() === 0) greet();
      };
      syncReady = sync;
      const observer = new IntersectionObserver(([entry]) => {
        const enteredBefore = visible;
        if (entry.intersectionRatio >= .3) visible = true;
        else if (entry.intersectionRatio < .12) visible = false;
        sync();
        if (visible && !enteredBefore) greet();
      }, { threshold: [0, .12, .3] });
      observer.observe(element);
      const inert = new MutationObserver(sync);
      const invitation = element.closest(".invitation");
      if (invitation) inert.observe(invitation, { attributes: true, attributeFilter: ["inert"] });
      document.addEventListener("visibilitychange", sync);
      return () => {
        observer.disconnect(); inert.disconnect();
        document.removeEventListener("visibilitychange", sync);
        syncReady = () => {};
        controller.current = null;
        element.dataset.idleRunning = "false";
        element.dataset.waveState = "idle";
        element.dataset.blinkState = "open";
      };
    });
    return () => {
      alive = false;
      loaders.forEach(({ image }) => { image.onload = null; image.onerror = null; });
      mm.revert();
    };
  }, { scope: root, dependencies: [kind, autoWave, priority], revertOnUpdate: true });
  return controller;
}
