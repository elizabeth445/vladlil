"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, MotionPathPlugin, ScrollTrigger);

export default function FlyingPaperPlane() {
  const root = useRef<HTMLButtonElement>(null);
  const sequence = useRef<gsap.core.Timeline | null>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const makePath = () => {
          const radius = Math.min(
            150,
            (root.current!.parentElement!.clientWidth - 96) / 2 - 10,
          );
          return Array.from({ length: 49 }, (_, i) => {
            const t = i / 48;
            const r = Math.max(0, radius) * Math.sin(Math.PI * t);
            return {
              x: Math.sin(t * Math.PI * 4) * r,
              y: -Math.cos(t * Math.PI * 4) * r - 20 * Math.sin(Math.PI * t),
            };
          });
        };
        const motionPath = { path: makePath(), curviness: 1.4, autoRotate: 35 };
        const timeline = gsap
          .timeline({ paused: true })
          .to(".rsvp-paper-plane", {
            motionPath,
            duration: 5.2,
            ease: "power1.inOut",
          })
          .to(".rsvp-paper-plane", {
            x: 0,
            y: 0,
            rotation: 0,
            duration: 0.4,
            ease: "sine.out",
          });
        sequence.current = timeline;
        const parent = root.current!.parentElement!;
        let previousWidth = parent.clientWidth;
        const observer = new ResizeObserver(() => {
          if (Math.abs(parent.clientWidth - previousWidth) < 1) return;
          previousWidth = parent.clientWidth;
          timeline.pause().progress(1).invalidate();
          motionPath.path = makePath();
        });
        observer.observe(parent);
        ScrollTrigger.create({
          trigger: root.current,
          start: "top 85%",
          once: true,
          onEnter: () => timeline.play(),
        });
        return () => {
          observer.disconnect();
          sequence.current = null;
        };
      });
      return () => mm.revert();
    },
    { scope: root },
  );
  return (
    <button
      ref={root}
      type="button"
      className="paper-plane-play"
      aria-label="Запустити літачок по спіралі"
      onClick={() => sequence.current?.restart()}
    >
      <svg className="rsvp-paper-plane" viewBox="0 0 110 85" aria-hidden="true">
        <path
          d="M7 73C29 78 45 65 33 55C22 45 13 65 39 62C53 60 61 48 65 40"
          fill="none"
          stroke="#b99b78"
          strokeWidth="1.3"
          strokeDasharray="3 5"
          strokeLinecap="round"
        />
        <path
          d="m44 27 53-17-17 49-14-20-22-12Z"
          fill="#dcebf2"
          stroke="#668fa9"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="m66 39 31-29-23 35-1 10 7-8"
          fill="#f8e3e8"
          stroke="#668fa9"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <path d="m33 12 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#e9bc6e" />
      </svg>
    </button>
  );
}
