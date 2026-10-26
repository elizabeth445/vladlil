"use client";
import { useEffect, useId, useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Heart } from "lucide-react";
import { Butterfly, Character, Star } from "./Artwork";
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

export function PlayfulCharacter({
  kind,
  priority = false,
}: {
  kind: "lion" | "kitten";
  priority?: boolean;
}) {
  const root = useRef<HTMLButtonElement>(null);
  const animation = useRef<gsap.core.Timeline | null>(null);
  const messageId = useId();
  const { contextSafe } = useGSAP({ scope: root });
  useMotionPreference(animation);
  const greet = () =>
    contextSafe(() => {
      animation.current?.kill();
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const timeline = gsap.timeline();
      animation.current = timeline;
      gsap.set(".character-reaction", { x: 0, y: 0, rotation: 0, scale: 1 });
      gsap.set(".greeting-spark", { x: 0, y: 0, opacity: 0, scale: 0.5 });
      timeline.fromTo(
        ".character-greeting",
        { autoAlpha: 0, y: 6 },
        { autoAlpha: 1, y: 0, duration: reduced ? 0 : 0.25 },
        0,
      );
      if (!reduced) {
        timeline
          .to(
            ".character-reaction",
            {
              y: kind === "lion" ? -16 : -5,
              rotation: kind === "lion" ? -4 : 7,
              scale: kind === "lion" ? 1.02 : 1.035,
              duration: 0.28,
              ease: "power2.out",
            },
            0,
          )
          .to(
            ".character-reaction",
            {
              y: 0,
              rotation: kind === "lion" ? 3 : -3,
              scale: 1,
              duration: 0.32,
              ease: "sine.inOut",
            },
            0.28,
          )
          .to(
            ".character-reaction",
            { rotation: 0, duration: 0.35, ease: "sine.out" },
            0.6,
          )
          .to(
            ".greeting-spark",
            {
              x: (i) => (i - 2) * 24,
              y: (i) => -25 - (2 - Math.abs(i - 2)) * 20,
              scale: 1,
              opacity: 1,
              stagger: 0.04,
              duration: 0.4,
              ease: "power2.out",
            },
            0.12,
          )
          .to(
            ".greeting-spark",
            { y: "-=25", opacity: 0, scale: 0.7, duration: 0.6 },
            0.6,
          );
      }
      timeline.to(
        ".character-greeting",
        { autoAlpha: 0, y: reduced ? 0 : -4, duration: reduced ? 0 : 0.35 },
        2.1,
      );
    })();
  return (
    <button
      ref={root}
      type="button"
      className={`character-play character-play-${kind}`}
      aria-label={
        kind === "lion" ? "Привітатися з левеням" : "Погладити кошеня"
      }
      aria-describedby={messageId}
      onClick={greet}
    >
      <span className="character-greeting" id={messageId}>
        {kind === "lion" ? "Радий вас бачити!" : "Мур-р! До зустрічі!"}
      </span>
      <span className="character-halo" aria-hidden="true" />
      <span className="character-reaction">
        <Character kind={kind} className="breathing" priority={priority} />
      </span>
      <span className="greeting-sparks" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <span className="greeting-spark" key={i}>
            {kind === "lion" ? <Star /> : <Heart fill="currentColor" />}
          </span>
        ))}
      </span>
    </button>
  );
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
