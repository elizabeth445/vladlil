"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const colors = ["#91bdd4", "#df9eb3", "#d4af69", "#a9bcad", "#cdb4d6"];
// Stable values keep the server and browser markup identical.
const scatter = (index: number, salt: number) => {
  let value = (index + 1) * 374761393 + salt * 668265263;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
};

export default function ClosingConfetti({ active }: { active: boolean }) {
  const layer = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const element = layer.current;
    const section = element?.closest(".closing");
    const greeting = section?.querySelector(".closing-greeting");
    if (!active || !element || !greeting) return;

    const media = gsap.matchMedia();
    media.add({
      motion: "(prefers-reduced-motion: no-preference)",
      mobile: "(max-width: 767px)",
      desktop: "(min-width: 768px)",
    }, context => {
      if (!context.conditions?.motion) return;
      const pieces = Array.from(element.children).slice(0, context.conditions.mobile ? 54 : 84);
      let width = element.clientWidth;
      let height = element.clientHeight;
      const burst = gsap.timeline({
        scrollTrigger: {
          trigger: greeting,
          start: "top 90%",
          once: true,
          invalidateOnRefresh: true,
          onRefreshInit: () => {
            width = element.clientWidth;
            height = element.clientHeight;
          },
        },
      });

      pieces.forEach((piece, index) => {
        const side = index % 2 === 0 ? 1 : -1;
        const delay = scatter(index, 2) * 0.22;
        const rise = 0.85 + scatter(index, 3) * 0.4;
        const fall = 2.1 + scatter(index, 4) * 0.8;
        const launchX = () => width * (side === 1 ? 0.12 : 0.88);
        const apexX = () => width * (0.04 + scatter(index, 5) * 0.92);
        burst.fromTo(piece, {
          x: launchX,
          y: () => height * 0.7,
          opacity: 0,
          rotation: side * 35,
          scale: 0.65,
        }, {
          x: apexX,
          y: () => height * (0.04 + scatter(index, 6) * 0.32),
          opacity: 0.85,
          scale: 1,
          rotation: side * (130 + scatter(index, 7) * 170),
          duration: rise,
          ease: "power2.out",
        }, delay)
          .to(piece, {
            x: () => apexX() + side * width * (0.03 + scatter(index, 8) * 0.09),
            y: () => height + 24,
            rotation: side * (460 + scatter(index, 9) * 300),
            rotationX: side * 240,
            duration: fall,
            ease: "power1.in",
          }, delay + rise)
          .to(piece, { opacity: 0, duration: 0.85, ease: "sine.in" }, delay + rise + fall - 0.85);
      });
    });
    return () => media.revert();
  }, { scope: layer, dependencies: [active], revertOnUpdate: true });

  return (
    <div ref={layer} className="closing-confetti" aria-hidden="true">
      {Array.from({ length: 84 }, (_, index) => (
        <span
          key={index}
          className={`closing-confetti-piece confetti-kind-${index % 3}`}
          style={{ backgroundColor: colors[index % colors.length] }}
        />
      ))}
    </div>
  );
}
