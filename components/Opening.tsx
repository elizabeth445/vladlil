"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Heart, ArrowRight } from "lucide-react";
import { Character, Star, Butterfly, Balloon } from "./Artwork";
import OpeningArrival from "./OpeningArrival";
import { MusicToggle } from "./BackgroundMusic";
import { createOpeningMorph, prepareOpeningMorph } from "@/lib/opening-morph";
gsap.registerPlugin(useGSAP);
export default function Opening({ onOpened, onOpenStart, musicMuted, onMusicToggle }: {
  onOpened: (morphed?: boolean) => void;
  onOpenStart: () => void;
  musicMuted: boolean;
  onMusicToggle: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  const sequence = useRef<gsap.core.Timeline | null>(null);
  const preview = useRef<gsap.core.Timeline | null>(null);
  const finished = useRef(false);
  const morph = useRef<ReturnType<typeof createOpeningMorph> | null>(null);
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
  const complete = useCallback((morphed = false) => {
    if (finished.current) return;
    finished.current = true;
    if (fallback.current) clearTimeout(fallback.current);
    morph.current?.cleanup();
    morph.current = null;
    onOpened(morphed);
  }, [onOpened]);
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
      if (query.matches && sequence.current) complete(true);
    };
    const resized = () => { if (morph.current) complete(true); };
    query.addEventListener("change", changed);
    window.addEventListener("resize", resized);
    return () => {
      cancelAnimationFrame(resetScroll);
      document.body.style.overflow = previous;
      document.documentElement.style.overflowAnchor = previousAnchor;
      query.removeEventListener("change", changed);
      window.removeEventListener("resize", resized);
      morph.current?.cleanup();
      if (fallback.current) clearTimeout(fallback.current);
    };
  }, [complete]);
  const { contextSafe } = useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        preview.current = gsap
          .timeline({
            paused: true,
            defaults: { duration: 0.4, ease: "sine.inOut" },
          })
          .to(".envelope", { y: -7, rotation: -1.2 }, 0)
          .to(".envelope-seal", { scale: 1.08 }, 0);
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
      onOpenStart();
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        complete();
        return;
      }
      const compactScene = matchMedia("(max-width: 1100px), (max-height: 500px)").matches;
      setBusy(true);
      preview.current?.pause();
      fallback.current = setTimeout(() => complete(true), 7000);
      try {
        if (root.current) prepareOpeningMorph(root.current);
        sequence.current = gsap
          .timeline({
            onComplete: contextSafe(() => {
              try {
                if (finished.current || !root.current) return;
                morph.current = createOpeningMorph(root.current, () => complete(true));
                morph.current.timeline.play();
              } catch {
                complete(true);
              }
            }),
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
          .to(
            ".held-balloon-flight",
            {
              x: (i) => [-85, 12, 60, -60, -12, 85][i],
              y: (i) => -window.innerHeight - 80 - (i % 3) * 45,
              rotation: (i) => [-18, 5, 21, -21, -5, 18][i],
              stagger: 0.075,
              duration: 1.55,
              ease: "power1.in",
              zIndex: 2,
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
          .to(".envelope-letter", { rotation: 0, scale: 1, duration: 0.16, ease: "sine.out" }, 2.02);
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
      <MusicToggle muted={musicMuted} onToggle={onMusicToggle} />
      {arriving ? <OpeningArrival onReady={arrivalReady} /> : null}
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
            src="/art/lion-opening-close.webp"
            className="opening-lion"
            priority
            morphKey="lion"
          >
            <BalloonBouquet kind="lion" />
          </Character>
          <Character kind="kitten" className="opening-kitten" priority morphKey="kitten">
            <BalloonBouquet kind="kitten" />
          </Character>
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
                <small className="envelope-invitation" data-morph="invitation">Запрошуємо на день народження</small>
                <span className="envelope-names">
                  <span className="envelope-name-blue" data-morph="lion-name">Владислава</span>
                  <br />
                  <span className="envelope-conjunction" data-morph="conjunction">та</span>{" "}
                  <span className="envelope-name-pink" data-morph="kitten-name">Лілії</span>
                </span>
                <small data-morph="age" className="envelope-age">Нам виповнюється <strong>2 рочки!</strong></small>
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

function BalloonBouquet({ kind }: { kind: "lion" | "kitten" }) {
  const colors = kind === "lion" ? ["blue", "gold", "sage"] : ["pink", "gold", "pink"];
  const knots = [[34, 84], [72.5, 60], [109, 99]];
  return (
    <div className="held-bouquet" aria-hidden="true">
      {colors.map((color, i) => (
        <div key={i} className={`held-balloon-flight held-flight-${i}`}>
          {[false, true].map(grip => (
            <svg key={String(grip)} className={`held-balloon-thread${grip ? " held-balloon-grip" : ""}`} viewBox="0 0 140 230">
              <path
                d={grip ? "M80 216Q90 221 100 225" : `M${knots[i][0]} ${knots[i][1]}C${knots[i][0] - 18} ${knots[i][1] + 45} 10 190 100 225`}
                fill="none"
                stroke="#b69d7c"
                strokeWidth="0.8"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                transform={kind === "kitten" ? "translate(140 0) scale(-1 1)" : undefined}
              />
            </svg>
          ))}
          <Balloon color={color} className={`held-balloon held-balloon-${i}`} />
        </div>
      ))}
    </div>
  );
}
