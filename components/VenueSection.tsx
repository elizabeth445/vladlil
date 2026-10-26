"use client";

import { useRef, type PointerEvent } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowUpRight, CalendarDays, Clock3, MapPin } from "lucide-react";
import { EVENT } from "@/lib/event";
import { Star } from "./Artwork";

gsap.registerPlugin(useGSAP, ScrollTrigger);

type HoverControls = {
  move: (x: number, y: number) => void;
  reset: () => void;
};

export default function VenueSection({ active }: { active: boolean }) {
  const root = useRef<HTMLElement>(null);
  const hover = useRef<HoverControls | null>(null);
  const entrance = useRef<gsap.core.Timeline | null>(null);
  const reaction = useRef<gsap.core.Timeline | null>(null);
  useGSAP(
    () => {
      if (!active || !root.current) return;
      const photo = root.current.querySelector<HTMLButtonElement>(".venue-image");
      if (!photo) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        entrance.current = gsap
          .timeline({
            scrollTrigger: { trigger: root.current, start: "top 82%", once: true },
          })
          .from(".venue-photo-stage", {
            y: 32,
            rotation: -3,
            opacity: 0.55,
            duration: 1.05,
            ease: "power3.out",
            clearProps: "transform,opacity",
          }, 0)
          .from(".venue-copy > *", {
            y: 12,
            opacity: 0,
            duration: 0.65,
            stagger: 0.08,
            ease: "power2.out",
            clearProps: "transform,opacity",
          }, 0.16)
          .fromTo(".venue-route", { clipPath: "inset(0 100% 0 0)" }, {
            clipPath: "inset(0 0% 0 0)",
            duration: 1.7,
            ease: "power1.inOut",
          }, 0.15)
          .from(".venue-pin", {
            scale: 0.65,
            rotation: -16,
            opacity: 0,
            duration: 0.65,
            ease: "back.out(1.5)",
            clearProps: "transform,opacity",
          }, 0.7);

        const pointerEase = { duration: 0.5, ease: "power3.out" };
        const rotateX = gsap.quickTo(photo, "rotationX", pointerEase);
        const rotateY = gsap.quickTo(photo, "rotationY", pointerEase);
        const lift = gsap.quickTo(photo, "y", pointerEase);
        hover.current = {
          move: (x, y) => {
            rotateX(-y * 4);
            rotateY(x * 5);
            lift(-5);
          },
          reset: () => {
            rotateX(0);
            rotateY(0);
            lift(0);
          },
        };
        reaction.current = gsap
          .timeline({ paused: true })
          .to(photo, { scale: 0.985, rotation: -1.5, duration: 0.16, ease: "power2.out" })
          .to(photo, { scale: 1.012, rotation: 1.4, duration: 0.35, ease: "back.out(1.6)" })
          .to(photo, { scale: 1, rotation: 0, duration: 0.45, ease: "sine.out" })
          .fromTo(".venue-twinkle", { opacity: 0, scale: 0.5 }, {
            opacity: 0.85,
            scale: 1,
            duration: 0.3,
            stagger: 0.06,
            ease: "back.out(1.6)",
          }, 0.15)
          .to(".venue-twinkle", {
            opacity: 0,
            scale: 1.25,
            duration: 0.55,
            stagger: 0.06,
            ease: "sine.out",
          }, 0.6);
        return () => {
          hover.current = null;
          entrance.current = null;
          reaction.current = null;
        };
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [active], revertOnUpdate: true },
  );

  const tilt = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "mouse" || !hover.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    hover.current.move(
      (event.clientX - bounds.left) / bounds.width - 0.5,
      (event.clientY - bounds.top) / bounds.height - 0.5,
    );
  };

  return (
    <section ref={root} id="location" className="location-section section">
      <div className="venue-atmosphere" aria-hidden="true">
        <svg
          className="venue-route"
          viewBox="0 0 1200 660"
          preserveAspectRatio="none"
        >
          <path
            d="M39 110C5 184 20 415 88 486S246 608 316 562 277 486 258 538 363 617 503 574"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeDasharray="3 8"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx="39" cy="110" r="4" fill="currentColor" />
          <circle cx="503" cy="574" r="5" fill="none" stroke="currentColor" />
        </svg>
        <Star className="venue-star venue-star-blue" />
        <Star className="venue-star venue-star-gold" />
        <span className="venue-pin">
          <MapPin size={27} strokeWidth={1.25} />
        </span>
      </div>
      <div className="venue-photo-stage">
        <button
          type="button"
          className="venue-image"
          aria-label="Пожвавити акварельну листівку ресторану FRANCO"
          onPointerMove={tilt}
          onPointerLeave={() => hover.current?.reset()}
          onBlur={() => hover.current?.reset()}
          onClick={() => {
            hover.current?.reset();
            entrance.current?.progress(1);
            reaction.current?.restart();
          }}
        >
          <Image
            src="/art/franco-illustrated.webp"
            alt="Акварельна ілюстрація фасаду ресторану FRANCO у Козині"
            width={1200}
            height={800}
            sizes="(max-width: 767px) 100vw, 50vw"
          />
          <span className="venue-caption">
            Там, де збираються найрідніші
          </span>
        </button>
        <Star className="venue-twinkle venue-twinkle-one" />
        <Star className="venue-twinkle venue-twinkle-two" />
        <Star className="venue-twinkle venue-twinkle-three" />
      </div>
      <div className="venue-copy">
        <h2>Де зустрінемося?</h2>
        <h3>
          Ресторан <strong>FRANCO</strong>
        </h3>
        <dl>
          <div>
            <dt>
              <CalendarDays size={20} />
              <span className="sr-only">Дата</span>
            </dt>
            <dd>15 листопада 2026 року</dd>
          </div>
          <div>
            <dt>
              <Clock3 size={20} />
              <span className="sr-only">Час</span>
            </dt>
            <dd>Початок о 16:00</dd>
          </div>
          <div>
            <dt>
              <MapPin size={20} />
              <span className="sr-only">Адреса</span>
            </dt>
            <dd>
              смт. Козин,
              <br />
              Обухівське шосе, 43В
            </dd>
          </div>
        </dl>
        <a
          className="button"
          href={EVENT.directions}
          target="_blank"
          rel="noopener noreferrer"
        >
          Прокласти маршрут
          <ArrowUpRight size={18} />
        </a>
        <a
          className="text-link"
          href={EVENT.website}
          target="_blank"
          rel="noopener noreferrer"
        >
          Сайт ресторану
          <ArrowUpRight size={16} />
        </a>
      </div>
    </section>
  );
}
