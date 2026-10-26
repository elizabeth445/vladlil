"use client";

import { useId, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const sheet = "/art/greeting-poses.webp";
function GreetingCharacter({ kind }: { kind: "lion" | "kitten" }) {
  const id = useId().replaceAll(":", "");
  const row = kind === "lion" ? 0 : -100;
  const [cx, cy] = kind === "lion" ? [72, 53] : [25, 48];
  // A continuous field moves the wrist and fades to zero at the shoulder.
  // No cut-out limb or hard mask boundary can separate the paw from the body.
  const motionMap = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="wave"><stop stop-color="#ee7c80"/><stop offset=".3" stop-color="#dc7e80"/><stop offset=".7" stop-color="#9a8080"/><stop offset="1" stop-color="#808080"/></radialGradient></defs><path fill="#808080" d="M0 0h100v100H0z"/><ellipse cx="${cx}" cy="${cy}" rx="11" ry="24" fill="url(#wave)"/></svg>`)}`;
  return (
    <span className={`greeting-character greeting-${kind}`} aria-hidden="true">
      {[0, 1].map((pose) => (
        <svg
          key={pose}
          className={`greeting-pose greeting-pose-${pose}`}
          viewBox="0 0 100 100"
        >
          <image
            href={sheet}
            x={-pose * 100}
            y={row}
            width="400"
            height="200"
          />
        </svg>
      ))}
      <svg className="greeting-pose greeting-pose-wave" viewBox="0 0 100 100">
        <defs>
          <filter
            id={`wave-${id}`}
            filterUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="100"
            height="100"
            colorInterpolationFilters="sRGB"
          >
            <feImage
              href={motionMap}
              x="0"
              y="0"
              width="100"
              height="100"
              preserveAspectRatio="none"
              result="paw-motion-map"
            />
            <feDisplacementMap
              className="greeting-paw-motion"
              in="SourceGraphic"
              in2="paw-motion-map"
              scale="0"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
        <image
          className="greeting-paw"
          href={sheet}
          x="-200"
          y={row}
          width="400"
          height="200"
          filter={`url(#wave-${id})`}
        />
      </svg>
    </span>
  );
}

function createGreetingTimeline(container: HTMLElement) {
  const select = gsap.utils.selector(container);
  gsap.set(select(".greeting-pose-0"), { opacity: 1 });
  gsap.set(select(".greeting-pose-1"), { opacity: 0 });
  const timeline = gsap.timeline({
    paused: true,
    defaults: { duration: 0.35, ease: "power1.inOut" },
  });
  timeline
    .set(select(".greeting-pose-0"), { opacity: 1 })
    .set(select(".greeting-pose-1, .greeting-pose-wave"), { opacity: 0 })
    .set(select(".greeting-paw-motion"), { attr: { scale: 0 } })
    .to(select(".greeting-pose-0"), { opacity: 0 }, 0.7)
    .to(select(".greeting-pose-1"), { opacity: 1 }, "<")
    .to(select(".greeting-pose-1"), { opacity: 0 }, "+=0.4")
    .to(select(".greeting-pose-wave"), { opacity: 1 }, "<")
    .to(
      select(".greeting-lion .greeting-paw-motion"),
      { attr: { scale: 8.5 }, duration: 0.32, repeat: 3, yoyo: true, ease: "sine.inOut" },
      "+=0.05",
    )
    .to(
      select(".greeting-kitten .greeting-paw-motion"),
      { attr: { scale: -8.5 }, duration: 0.32, repeat: 3, yoyo: true, ease: "sine.inOut" },
      "<0.08",
    )
    .to(select(".greeting-pose-wave"), { opacity: 0 }, "+=0.2")
    .to(select(".greeting-pose-1"), { opacity: 1 }, "<");
  return timeline;
}

export default function ClosingGreeting() {
  const root = useRef<HTMLButtonElement>(null);
  const sequence = useRef<gsap.core.Timeline | null>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const timeline = createGreetingTimeline(root.current!);
        sequence.current = timeline;
        ScrollTrigger.create({
          trigger: root.current,
          start: "top 78%",
          end: "bottom 18%",
          onEnter: () => timeline.restart(),
          onEnterBack: () => timeline.restart(),
        });
        return () => {
          sequence.current = null;
        };
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <button
      ref={root}
      type="button"
      className="closing-greeting"
      onClick={() => sequence.current?.restart()}
      aria-label="Привітатися з іменинниками ще раз"
    >
      <span className="greeting-flowers" aria-hidden="true" />
      <GreetingCharacter kind="lion" />
      <GreetingCharacter kind="kitten" />
    </button>
  );
}
