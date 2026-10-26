"use client";
import { useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { CalendarPlus, Heart } from "lucide-react";
import { calendarDays } from "@/lib/event";
import { Ribbon, Star } from "./Artwork";
gsap.registerPlugin(useGSAP, ScrollTrigger);
export default function Calendar() {
  const [note, setNote] = useState(false);
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ".date-heart path",
          { strokeDashoffset: 1 },
          {
            strokeDashoffset: 0,
            autoRound: false,
            duration: 1.4,
            repeat: -1,
            repeatDelay: 3,
            ease: "power2.inOut",
            scrollTrigger: {
              trigger: ".calendar-paper",
              start: "top 85%",
              end: "bottom 15%",
              toggleActions: "play pause resume pause",
            },
          },
        );
      });
      return () => mm.revert();
    },
    { scope: root },
  );
  return (
    <section ref={root} id="date" className="calendar-section section">
      <div className="calendar-copy">
        <Star />
        <h2>
          Збережіть цю дату
          <br />у своєму серці
        </h2>
        <p>
          Один листопадовий день,
          <br />у якому буде так багато тепла.
        </p>
        <a
          className="button secondary"
          href="/api/calendar"
          download="birthday-2026.ics"
        >
          <CalendarPlus size={19} />
          Додати в календар
        </a>
        <span className="timezone-note">
          15 листопада о 16:00 · за київським часом
        </span>
      </div>
      <div className="calendar-paper">
        <Ribbon className="calendar-bow" />
        <h3>
          Листопад <span>2026</span>
        </h3>
        <div
          className="calendar-grid"
          role="group"
          aria-label="Календар на листопад 2026"
        >
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map((day) => (
            <span className="weekday" key={day}>
              {day}
            </span>
          ))}
          {calendarDays().map((day, i) => (
            <div
              className={`calendar-day ${day === 15 ? "celebration-day" : ""}`}
              key={i}
            >
              {day === 15 ? (
                <>
                  <button
                    aria-label="15 листопада — наше свято"
                    aria-expanded={note}
                    aria-controls="date-note"
                    onClick={() => setNote((visible) => !visible)}
                  >
                    <svg
                      className="date-heart"
                      viewBox="0 0 64 60"
                      aria-hidden="true"
                    >
                      <path
                        d="M32 54C25 49 6 36 6 21C6 5 25 3 32 17C39 3 58 5 58 21C58 36 39 49 32 54Z"
                        pathLength="1"
                      />
                    </svg>
                    <span>15</span>
                  </button>
                </>
              ) : (
                <span>{day}</span>
              )}
            </div>
          ))}
        </div>
        <div
          id="date-note"
          className={`date-note ${note ? "visible" : ""}`}
          aria-live="polite"
        >
          {note ? (
            "15 листопада — наше свято! Початок о 16:00"
          ) : (
            <>
              <Heart size={15} /> Тут живе наш особливий день
            </>
          )}
        </div>
      </div>
    </section>
  );
}
