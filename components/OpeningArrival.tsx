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
const balloons = Array.from({ length: 48 }, (_, i) => ({
  desktopLeft: fraction(0.5 + i * 0.754877666) * 108 - 4,
  mobileLeft: fraction(0.23 + i * 0.618033989) * 114 - 7,
  desktopTop: fraction(0.5 + i * 0.569840291) * 106 - 18,
  mobileTop: fraction(0.16 + i * 0.414213562) * 110 - 18,
  size: Math.round(290 + sample(i, 1) * 150),
  color: Math.floor(sample(i, 2) * 6),
}));

export default function OpeningArrival({ onReady, departing = false }: { onReady: () => void; departing?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const ready = useRef(onReady);
  const flight = useRef<gsap.core.Timeline | null>(null);
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
          const timeline = gsap.timeline({ paused: true, onComplete: () => ready.current() });
          flight.current = timeline;
          const height = window.innerHeight;
          const width = window.innerWidth;
          const mobile = width < 768;
          flights
            .filter((_, i) => !mobile || i < 28)
            .forEach((flight, i) => {
              const balloon = balloons[i];
              const drift = (sample(i, 4) - 0.5) * 2;
              const left = mobile ? balloon.mobileLeft : balloon.desktopLeft;
              const top = mobile ? balloon.mobileTop : balloon.desktopTop;
              const direction = sample(i, 7);
              const sideways = direction < 0.42;
              const exitsLeft = direction < 0.21;
              const endX = sideways
                ? exitsLeft
                  ? -left / 100 * width - flight.offsetWidth - 80
                  : (1 - left / 100) * width + flight.offsetWidth + 80
                : drift * width * (0.18 + sample(i, 8) * 0.45);
              const endY = sideways
                ? drift * height * 0.55
                : -top / 100 * height - flight.offsetHeight - 100;
              // The CSS positions are visible before hydration; only the departure animates.
              timeline.to(
                flight,
                {
                  x: endX,
                  y: endY,
                  rotation: drift * (sideways ? 26 : 12),
                  duration: 1.8 + sample(i, 9) * 1.05,
                  ease: "power1.inOut",
                },
                0.4 + sample(i, 10) * 0.8,
              );
              timeline.fromTo(
                flight.querySelector(".arrival-balloon-sway"),
                { rotation: -drift * 10 },
                {
                  rotation: drift * 12,
                  duration: 0.9 + sample(i, 11) * 0.3,
                  repeat: 2,
                  yoyo: true,
                  ease: "sine.inOut",
                },
                0,
              );
            });
          timeline.to(root.current, { autoAlpha: 0, duration: 0.45 }, 4.15);
          const artwork = root.current?.querySelector("img");
          const start = () => timeline.play();
          if (!artwork || artwork.complete) start();
          else {
            artwork.addEventListener("load", start, { once: true });
            artwork.addEventListener("error", start, { once: true });
          }
          return () => {
            flight.current = null;
            artwork?.removeEventListener("load", start);
            artwork?.removeEventListener("error", start);
          };
        },
      );
      return () => mm.revert();
    },
    { scope: root },
  );
  useGSAP(() => {
    if (departing) flight.current?.timeScale(6).play();
  }, { dependencies: [departing], scope: root });

  return (
    <div ref={root} className="opening-arrival" aria-hidden="true">
      <div className="arrival-balloon-field">
        {balloons.map(({ desktopLeft, mobileLeft, desktopTop, mobileTop, size, color }, i) => (
          <div
            key={i}
            className="arrival-balloon-flight"
            style={
              {
                "--desktop-left": `${desktopLeft}%`,
                "--mobile-left": `${mobileLeft}%`,
                "--desktop-top": `${desktopTop}%`,
                "--mobile-top": `${mobileTop}%`,
                "--balloon-width": `${size}px`,
                zIndex: size,
              } as CSSProperties
            }
          >
            <PearlBalloon className="arrival-balloon-sway" color={color} priority={i === 0} />
          </div>
        ))}
      </div>
    </div>
  );
}
