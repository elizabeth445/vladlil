"use client";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Butterfly } from "./Artwork";
gsap.registerPlugin(useGSAP);

function useMotionPreference(
  animation: React.RefObject<gsap.core.Timeline | null>,
) {
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const finish = () => {
      if (query.matches) animation.current?.progress(1);
    };
    query.addEventListener("change", finish);
    return () => query.removeEventListener("change", finish);
  }, [animation]);
}

export function PlayfulButterfly({ className = "" }: { className?: string }) {
  const root = useRef<HTMLButtonElement>(null),
    animation = useRef<gsap.core.Timeline | null>(null);
  const { contextSafe } = useGSAP({ scope: root });
  useMotionPreference(animation);
  const fly = () =>
    contextSafe(() => {
      animation.current?.kill();
      gsap.set(".butterfly-flight", { x: 0, y: 0, rotation: 0, scale: 1 });
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      animation.current = gsap
        .timeline()
        .to(".butterfly-flight", {
          x: 22,
          y: -30,
          rotation: -20,
          scale: 0.9,
          duration: 0.4,
          ease: "sine.out",
        })
        .to(".butterfly-flight", {
          x: -25,
          y: -48,
          rotation: 15,
          scale: 1.05,
          duration: 0.5,
          ease: "sine.inOut",
        })
        .to(".butterfly-flight", {
          x: 0,
          y: 0,
          rotation: 0,
          scale: 1,
          duration: 0.65,
          ease: "power2.out",
        });
    })();
  return (
    <button
      ref={root}
      type="button"
      className={`butterfly-play ${className}`}
      aria-label="Пограти з метеликом"
      onClick={fly}
    >
      <span className="butterfly-flight">
        <Butterfly />
      </span>
    </button>
  );
}
