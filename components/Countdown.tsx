"use client";
import { memo, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { RotateCcw, Sparkles } from "lucide-react";
import { countdown } from "@/lib/event";
import { Balloon, Star, PartyArtwork } from "./Artwork";
gsap.registerPlugin(useGSAP, ScrollTrigger);
const units = ["Днів", "Годин", "Хвилин", "Секунд"];
const colors = ["blue", "pink", "gold", "sage"];
const confettiColors = ["#91bdd4", "#df9eb3", "#d4af69", "#99b49b", "#d9b5c3"];

const ClockBalloon = memo(function ClockBalloon({
  index,
  value,
}: {
  index: number;
  value: number | null;
}) {
  const root = useRef<HTMLButtonElement>(null);
  const animation = useRef<gsap.core.Timeline | null>(null);
  const poppedRef = useRef(false);
  const [popped, setPopped] = useState(false);
  const { contextSafe } = useGSAP({ scope: root });
  const restore = () =>
    contextSafe(() => {
      animation.current?.kill();
      poppedRef.current = false;
      setPopped(false);
      gsap.set(".confetti-piece", { opacity: 0 });
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      animation.current = gsap
        .timeline()
        .set(".balloon-remnant", { autoAlpha: 0 })
        .fromTo(
          ".balloon-pop-art",
          { scale: 0.7, autoAlpha: 0 },
          {
            scale: 1,
            autoAlpha: 1,
            duration: reduced ? 0 : 0.65,
            ease: "elastic.out(1,.6)",
          },
        );
    })();
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      if (media.matches) animation.current?.progress(1);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const pop = () =>
    contextSafe(() => {
      if (poppedRef.current) {
        restore();
        return;
      }
      animation.current?.kill();
      poppedRef.current = true;
      setPopped(true);
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const timeline = gsap.timeline();
      animation.current = timeline;
      if (reduced) {
        timeline
          .set(".balloon-pop-art", { autoAlpha: 0 })
          .set(".balloon-remnant", { autoAlpha: 1 });
        return;
      }
      timeline
        .to(".balloon-pop-art", {
          scale: 1.13,
          duration: 0.1,
          ease: "power2.in",
        })
        .to(
          ".balloon-pop-art",
          { scale: 0.4, autoAlpha: 0, duration: 0.12 },
          0.1,
        )
        .fromTo(
          ".balloon-remnant",
          { autoAlpha: 0, scale: 0.9 },
          { autoAlpha: 1, scale: 1, duration: 0.35 },
          0.28,
        );
      const particles = root.current?.querySelectorAll(".confetti-piece");
      if (particles) {
        gsap.set(particles, { x: 0, y: 0, opacity: 1, scale: 1, rotation: 0 });
        timeline
          .to(
            particles,
            {
              x: (i) => Math.cos(i * 2.4) * (52 + (i % 5) * 15),
              y: (i) => -40 - (i % 5) * 23,
              rotation: (i) => (i % 2 ? 1 : -1) * (90 + i * 31),
              duration: 0.6,
              ease: "power2.out",
            },
            0.12,
          )
          .to(
            particles,
            {
              y: "+=95",
              opacity: 0,
              scale: 0.6,
              duration: 0.65,
              stagger: 0.009,
              ease: "power1.in",
            },
            0.58,
          );
      }
    })();
  const display = value === null ? "··" : String(value).padStart(2, "0");
  return (
    <button
      ref={root}
      type="button"
      className={`clock-pop ${popped ? "is-popped" : ""}`}
      aria-label={`${popped ? "Повернути" : "Лопнути"} кульку «${units[index]}»`}
      aria-pressed={popped}
      onClick={pop}
    >
      <span className="balloon-pop-art" aria-hidden={popped}>
        <Balloon color={colors[index]} className="clock-balloon">
          <strong
            className={index === 3 ? "second-tick" : undefined}
            key={index === 3 ? value : index}
          >
            {display}
          </strong>
          <span>{units[index]}</span>
        </Balloon>
      </span>
      <span className="balloon-remnant" aria-hidden={!popped}>
        <strong>{display}</strong>
        <span>{units[index]}</span>
        <RotateCcw size={19} />
      </span>
      <span className="confetti-layer" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <span
            key={i}
            className={`confetti-piece shape-${i % 3}`}
            style={{
              backgroundColor: confettiColors[i % confettiColors.length],
            }}
          />
        ))}
      </span>
    </button>
  );
});

export default function Countdown() {
  const root = useRef<HTMLElement>(null);
  const [clock, setClock] = useState<ReturnType<typeof countdown> | null>(null);
  useEffect(() => {
    const tick = () => setClock(countdown(Date.now()));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);
  const finished = clock?.finished ?? false;
  useGSAP(
    () => {
      if (finished) return;
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        const flights = root.current?.querySelectorAll(".clock-flight");
        if (!flights) return;
        const timeline = gsap.timeline({
          scrollTrigger: {
            id: "birthday-balloon-flight",
            trigger: root.current,
            start: "top 22%",
            end: "bottom top",
            scrub: 0.65,
            invalidateOnRefresh: true,
          },
          defaults: { ease: "none" },
        });
        flights.forEach((flight, i) =>
          timeline.to(
            flight,
            {
              x: () => [-1, -0.25, 0.3, 1][i] * (innerWidth < 768 ? 46 : 135),
              y: () =>
                [-90, -160, -130, -75][i] * (innerWidth < 768 ? 0.65 : 1),
              rotation: [-17, -6, 9, 20][i],
              opacity: 0.15,
            },
            0,
          ),
        );
      });
      return () => media.revert();
    },
    { scope: root, dependencies: [finished], revertOnUpdate: true },
  );
  return (
    <section
      ref={root}
      className="countdown-section section"
      aria-labelledby="countdown-heading"
    >
      <Star className="countdown-star" />
      <h2 id="countdown-heading">
        До нашого свята
        <br />
        залишилося…
      </h2>
      {finished ? (
        <p className="finished-event">
          Наше чарівне свято вже відбулося!
          <br />
          <span>Дякуємо за спогади, які залишаться з нами.</span>
        </p>
      ) : (
        <>
          <div
            className="birthday-clock"
            role="timer"
            aria-label={
              clock
                ? `До свята: ${clock.values[0]} днів, ${clock.values[1]} годин, ${clock.values[2]} хвилин, ${clock.values[3]} секунд`
                : "Обчислюємо час до свята"
            }
          >
            {units.map((unit, i) => (
              <div key={unit} className={`clock-flight clock-${i}`}>
                <ClockBalloon index={i} value={clock?.values[i] ?? null} />
              </div>
            ))}
          </div>
          <div className="clock-play-note">
            <Sparkles size={19} />
            <p>
              Торкніться кульки —<br className="mobile-break" /> всередині
              маленьке свято!
            </p>
          </div>
        </>
      )}
      <p className="clock-caption">Ще трохи — і обіймемося!</p>
      <div className="birthday-treats" aria-hidden="true">
        <PartyArtwork kind="cake" color="blue" />
        <PartyArtwork kind="cake" color="pink" />
      </div>
    </section>
  );
}
