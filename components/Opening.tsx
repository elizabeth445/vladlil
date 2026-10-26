"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Heart, ArrowRight } from "lucide-react";
import { Character, Star, Butterfly, Balloon } from "./Artwork";
import OpeningArrival from "./OpeningArrival";
gsap.registerPlugin(useGSAP);
export default function Opening({ onOpened }: { onOpened: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  const sequence = useRef<gsap.core.Timeline | null>(null);
  const preview = useRef<gsap.core.Timeline | null>(null);
  const finished = useRef(false);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busy, setBusy] = useState(false);
  const [arriving, setArriving] = useState(true);
  const skipButton = useRef<HTMLButtonElement>(null);
  const arrivalReady = () => {
    if (finished.current) return;
    setArriving(false);
  };
  useEffect(() => {
    if (!arriving && matchMedia("(pointer: fine)").matches) openButton.current?.focus({ preventScroll: true });
  }, [arriving]);
  const complete = () => {
    if (finished.current) return;
    finished.current = true;
    if (fallback.current) clearTimeout(fallback.current);
    onOpened();
  };
  useLayoutEffect(() => {
    const previous = document.body.style.overflow;
    const previousAnchor = document.documentElement.style.overflowAnchor;
    document.documentElement.style.overflowAnchor = "none";
    document.body.style.overflow = "hidden";
    window.scrollTo({ top: 0, behavior: "instant" });
    // ScrollTrigger can restore its last position while the invitation scene cleans up.
    const resetScroll = requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "instant" }));
    (matchMedia("(pointer: coarse)").matches ? root.current : skipButton.current)?.focus({ preventScroll: true });
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => {
      if (query.matches && sequence.current) {
        sequence.current.progress(1);
      }
    };
    query.addEventListener("change", changed);
    return () => {
      cancelAnimationFrame(resetScroll);
      document.body.style.overflow = previous;
      document.documentElement.style.overflowAnchor = previousAnchor;
      query.removeEventListener("change", changed);
      if (fallback.current) clearTimeout(fallback.current);
    };
  }, []);
  const { contextSafe } = useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set(".opening-lion", { transformOrigin: "50% 96%" });
        gsap.set(".opening-kitten", { transformOrigin: "50% 93%" });
        preview.current = gsap
          .timeline({
            paused: true,
            defaults: { duration: 0.4, ease: "sine.inOut" },
          })
          .to(".envelope", { y: -7, rotation: -1.2 }, 0)
          .to(".envelope-seal", { scale: 1.08 }, 0)
          .to(".opening-lion", { x: 10, rotation: 2 }, 0)
          .to(".opening-kitten", { x: -10, rotation: -2 }, 0);
        return () => {
          preview.current = null;
        };
      });
      return () => mm.revert();
    },
    { scope: root },
  );
  const previewInteraction = (active: boolean) => {
    if (busy || arriving || finished.current || sequence.current) return;
    if (active) preview.current?.play();
    else preview.current?.reverse();
  };
  const open = () =>
    contextSafe(() => {
      if (busy || arriving || sequence.current || finished.current) return;
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        complete();
        return;
      }
      const compactScene = matchMedia("(max-width: 1100px), (max-height: 500px)").matches;
      setBusy(true);
      preview.current?.pause();
      fallback.current = setTimeout(complete, 6000);
      try {
        sequence.current = gsap
          .timeline({
            onComplete: complete,
            defaults: { ease: "power2.inOut" },
          })
          .to(".envelope", { scale: 0.96, rotation: 0, y: 0, duration: 0.18 })
          .to(".opening-caption", { autoAlpha: 0, duration: 0.28 }, 0)
          .to(
            ".envelope-seal",
            { scale: 1.35, opacity: 0, duration: 0.3 },
            0.18,
          )
          .to(
            ".envelope-flap",
            { rotationX: -180, duration: 0.7, transformOrigin: "50% 0%" },
            0.3,
          )
          .set(".envelope-flap", { zIndex: 0 }, 0.66)
          .to(".opening-scene", { y: compactScene ? 24 : 0, duration: 0.6 }, 0.3)
          .to(
            ".envelope-letter",
            {
              yPercent: compactScene ? -116 : -112,
              duration: 0.9,
              ease: "power3.inOut",
            },
            0.85,
          )
          .set(".envelope-letter-window", { zIndex: 6 }, 1.76)
          .to(
            ".envelope-letter",
            { rotation: -1.5, scale: 1.035, duration: 0.3, ease: "sine.out" },
            1.77,
          )
          .to(".opening-lion", { x: 16, rotation: 4, y: -6, duration: 0.6 }, 0.2)
          .to(
            ".opening-kitten",
            { x: -16, rotation: -4, y: -6, duration: 0.6 },
            0.3,
          )
          .to(
            ".opening-lion, .opening-kitten",
            {
              x: 0,
              rotation: 0,
              y: 0,
              duration: 0.65,
            },
            1.05,
          )
          .to(
            ".opening-balloon",
            {
              y: -window.innerHeight,
              rotation: 12,
              stagger: 0.1,
              duration: 1.3,
            },
            0.3,
          )
          .to(
            ".opening-spark",
            {
              x: (i) => (i % 2 ? 1 : -1) * (100 + i * 20),
              y: -100,
              rotation: 75,
              opacity: 0,
              stagger: 0.05,
              duration: 0.9,
            },
            0.7,
          )
          .to(".envelope", { scale: 1, duration: 0.5 }, 0.85)
          .to(root.current, { autoAlpha: 0, scale: 1.03, duration: 0.6 }, 2.12);
      } catch {
        complete();
      }
    })();
  const skip = () => {
    sequence.current?.kill();
    complete();
  };
  return (
    <div
      className={`opening ${arriving ? "is-arriving" : ""}`}
      ref={root}
      role="dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-labelledby="opening-title"
      onKeyDown={(e) => {
        if (e.key === "Escape") skip();
        if (e.key === "Tab" && root.current) {
          const controls = Array.from(
            root.current.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ),
          );
          const first = controls[0],
            last = controls[controls.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <button ref={skipButton} className="skip" onClick={skip}>
        Пропустити <ArrowRight size={15} />
      </button>
      {arriving ? <OpeningArrival onReady={arrivalReady} /> : null}
      <div className="opening-balloon-backdrop" aria-hidden="true">
        {["blue", "pink", "gold", "sage", "blue", "pink", "gold", "pink"].map(
          (color, i) => (
            <Balloon
              key={i}
              color={color}
              className={`opening-balloon opening-balloon-${i}`}
            />
          ),
        )}
      </div>
      <div className="opening-caption">
        <span className="little-hearts" aria-hidden="true">
          <Heart />
          <Heart />
        </span>
        <p id="opening-title">
          На вас чекає
          <br />
          особливе запрошення…
        </p>
        <span className="opening-dedication">від двох маленьких серденьок</span>
      </div>
      <div className="opening-scene">
        <div className="opening-character-backdrop" aria-hidden="true">
          <Character
            kind="lion"
            src="/art/lion-opening.webp"
            className="opening-lion"
            priority
          />
          <Character kind="kitten" className="opening-kitten" priority />
          <Butterfly className="opening-spark spark-c" />
        </div>
        <div className="opening-stage">
          <button
            type="button"
            className="envelope"
            aria-label="Відкрити конверт"
            disabled={busy || arriving}
            onClick={open}
            onPointerEnter={() => previewInteraction(true)}
            onPointerLeave={() => previewInteraction(false)}
            onPointerDown={() => previewInteraction(true)}
            onPointerCancel={() => previewInteraction(false)}
            onFocus={() => previewInteraction(true)}
            onBlur={() => previewInteraction(false)}
          >
            <span className="envelope-back" aria-hidden="true" />
            <span className="envelope-letter-window" aria-hidden="true">
              <span className="envelope-letter">
                <small className="envelope-invitation">Запрошуємо на день народження</small>
                <span className="envelope-names">
                  <span className="envelope-name-blue">Владислава</span>
                  <br />
                  <span className="envelope-conjunction">та</span>{" "}
                  <span className="envelope-name-pink">Лілії</span>
                </span>
                <small>Нам 2 рочки!</small>
              </span>
            </span>
            <span className="envelope-front" aria-hidden="true" />
            <span className="envelope-flap" aria-hidden="true" />
            <span className="envelope-seal" aria-hidden="true">
              <Heart fill="currentColor" />
            </span>
          </button>
          <Star className="opening-spark spark-a" />
          <Star className="opening-spark spark-b" />
        </div>
      </div>
      <button
        ref={openButton}
        className="button opening-button"
        onClick={open}
        onPointerEnter={() => previewInteraction(true)}
        onPointerLeave={() => previewInteraction(false)}
        onPointerDown={() => previewInteraction(true)}
        onPointerCancel={() => previewInteraction(false)}
        disabled={busy || arriving}
      >
        {busy ? "Трохи чарів…" : "Відкрити запрошення"} <Heart size={18} />
      </button>
      <p className="opening-footnote">
        Дві маленькі історії. Одне велике свято.
      </p>
    </div>
  );
}
