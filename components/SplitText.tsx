"use client";

// Adapted from React Bits SplitText (JS-CSS): https://reactbits.dev/text-animations/split-text
// This invitation uses only the one-shot, externally controlled reveal. No
// scroll/hover retrigger or spring ticker competes with the opening sequence.
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { SplitText as GSAPSplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(GSAPSplitText, useGSAP);
export default function SplitText({ text, active, className = "", delay = 32, settled = false, morphKey }: {
  text: string;
  active: boolean;
  className?: string;
  delay?: number;
  settled?: boolean;
  morphKey?: string;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    document.fonts.ready.then(() => { if (mounted) setFontsReady(true); });
    return () => { mounted = false; };
  }, []);
  useGSAP(() => {
    if (!active || !fontsReady) return;
    const element = root.current!;
    // A completed shared-element flight already contains the final glyphs.
    // Leave that DOM intact instead of replacing it at the handoff.
    if (settled) {
      element.dataset.revealState = "complete";
      return () => { element.dataset.revealState = "idle"; };
    }
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const split = new GSAPSplitText(element, { type: "chars", charsClass: "split-char", smartWrap: true });
      const tween = gsap.fromTo(split.chars,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.65, ease: "power3.out", stagger: delay / 1000,
          onStart: () => { element.dataset.revealState = "playing"; },
          onComplete: () => { element.dataset.revealState = "complete"; },
          clearProps: "transform,willChange" },
      );
      return () => { tween.kill(); split.revert(); element.dataset.revealState = "idle"; };
    });
    return () => mm.revert();
  }, { scope: root, dependencies: [active, fontsReady, text, delay, settled], revertOnUpdate: true });
  return <span ref={root} className={`split-parent ${className}`} data-morph={morphKey} data-reveal-state="idle">{text}</span>;
}
