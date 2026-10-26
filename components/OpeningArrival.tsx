"use client";

import { useRef, type CSSProperties } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { PearlBalloon } from "./Artwork";

// Stable scattered samples keep hydration consistent without visible rows.
function sample(index: number, salt: number) {
  let value = Math.imul(index + 1, 374761393) ^ Math.imul(salt, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}
const fraction = (value: number) => value - Math.floor(value);
const balloons = Array.from({ length: 40 }, (_, i) => ({
  desktopLeft: fraction(0.5 + i * 0.754877666) * 108 - 4,
  mobileLeft: fraction(0.23 + i * 0.618033989) * 114 - 7,
  depth: fraction(0.5 + i * 0.569840291),
  size: Math.round(270 + sample(i, 1) * 130),
  color: Math.floor(sample(i, 2) * 6),
}));

export default function OpeningArrival({ onReady }: { onReady: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const ready = useRef(onReady);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          reduce: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          if (context.conditions?.reduce) {
            ready.current();
            return;
          }
          const flights = gsap.utils.toArray<HTMLElement>(
            ".arrival-balloon-flight",
            root.current!,
          );
          const timeline = gsap.timeline({ onComplete: () => ready.current() });
          const height = window.innerHeight;
          const width = window.innerWidth;
          const mobile = width < 768;
          flights
            .filter((_, i) => !mobile || i < 24)
            .forEach((flight, i) => {
              const balloon = balloons[i];
              const offset = sample(i, 3) * 0.4;
              const drift = (sample(i, 4) - 0.5) * 2;
              const restingX = drift * width * 0.035;
              const left = mobile ? balloon.mobileLeft : balloon.desktopLeft;
              const direction = left < 25 ? -1 : left > 75 ? 1 : drift;
              timeline.fromTo(
                flight,
                { y: height + 80 + sample(i, 5) * 180, x: -drift * width * 0.12 },
                {
                  y: -100 + balloon.depth * (height + 50),
                  x: restingX,
                  duration: 0.8 + sample(i, 6) * 0.4,
                  ease: "power2.out",
                },
                offset,
              );
              timeline.to(
                flight,
                {
                  y: () => -flight.offsetHeight - 120 - sample(i, 7) * height * 0.2,
                  x: restingX + direction * width * (0.16 + sample(i, 8) * 0.35),
                  duration: 1.45 + sample(i, 9) * 0.85,
                  ease: "sine.in",
                },
                1.7 + sample(i, 10) * 0.3,
              );
              timeline.fromTo(
                flight.querySelector(".arrival-balloon-sway"),
                { rotation: -drift * 10 },
                {
                  rotation: drift * 12,
                  duration: 0.65 + sample(i, 11) * 0.3,
                  repeat: 3,
                  yoyo: true,
                  ease: "sine.inOut",
                },
                offset,
              );
              timeline.fromTo(
                flight.querySelector(".pearl-balloon-tail"),
                { rotation: drift * 4 },
                {
                  rotation: -drift * 5,
                  duration: 0.55 + sample(i, 12) * 0.2,
                  repeat: 4,
                  yoyo: true,
                  ease: "sine.inOut",
                },
                offset + 0.1,
              );
            });
          timeline.to(root.current, { autoAlpha: 0, duration: 0.45 }, 4.15);
        },
      );
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} className="opening-arrival" aria-hidden="true">
      <div className="arrival-balloon-field">
        {balloons.map(({ desktopLeft, mobileLeft, size, color }, i) => (
          <div
            key={i}
            className="arrival-balloon-flight"
            style={
              {
                "--desktop-left": `${desktopLeft}%`,
                "--mobile-left": `${mobileLeft}%`,
                "--balloon-width": `${size}px`,
                zIndex: size,
              } as CSSProperties
            }
          >
            <PearlBalloon className="arrival-balloon-sway" color={color} />
          </div>
        ))}
      </div>
    </div>
  );
}
