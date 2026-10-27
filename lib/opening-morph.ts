import { gsap } from "gsap";
import { Flip } from "gsap/Flip";

gsap.registerPlugin(Flip);

const keys = ["invitation", "lion-name", "conjunction", "kitten-name", "age", "lion", "kitten"];

/** Match the card's line breaks and font proportions before it leaves the pocket. */
export function prepareOpeningMorph(opening: HTMLElement) {
  const letter = opening.querySelector<HTMLElement>(".envelope-letter");
  const padding = letter ? getComputedStyle(letter) : null;
  const available = letter && padding ? letter.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight) - 2 : Infinity;
  for (const key of keys.slice(0, 5)) {
    const source = opening.querySelector<HTMLElement>(`[data-morph="${key}"]`);
    const target = document.querySelector<HTMLElement>(`#home [data-morph="${key}"]`);
    if (!source || !target) continue;
    const from = getComputedStyle(source);
    const to = getComputedStyle(target);
    const ratio = Math.min(parseFloat(from.fontSize) / parseFloat(to.fontSize), available / parseFloat(to.width));
    source.style.fontSize = `${parseFloat(to.fontSize) * ratio}px`;
    source.style.fontFamily = to.fontFamily;
    source.style.color = to.color;
    source.style.whiteSpace = to.whiteSpace;
    source.style.width = `${parseFloat(to.width) * ratio}px`;
    source.style.maxWidth = "100%";
    source.style.lineHeight = `${parseFloat(to.lineHeight) * ratio}px`;
    source.style.fontWeight = to.fontWeight;
    source.style.letterSpacing = `${(parseFloat(to.letterSpacing) || 0) * ratio}px`;
    const strong = source.querySelector<HTMLElement>("strong");
    const targetStrong = target.querySelector<HTMLElement>("strong");
    if (strong && targetStrong) strong.style.fontWeight = getComputedStyle(targetStrong).fontWeight;
  }
}

function artworkPath(image: HTMLImageElement) {
  const url = new URL(image.currentSrc, document.baseURI);
  return url.searchParams.get("url") ?? url.pathname;
}

const textProperties = [
  "color", "font-family", "font-size", "font-weight", "font-style",
  "font-variation-settings", "font-feature-settings", "letter-spacing",
  "line-height", "text-align", "white-space", "text-wrap", "text-transform",
];

function copyTypography(source: HTMLElement, copy: HTMLElement) {
  const style = getComputedStyle(source);
  for (const property of textProperties) copy.style.setProperty(property, style.getPropertyValue(property));
  Array.from(source.children).forEach((child, index) => {
    copyTypography(child as HTMLElement, copy.children[index] as HTMLElement);
  });
}

/** A temporary shared-element stage; the real layout stays unchanged underneath. */
export function createOpeningMorph(opening: HTMLElement, onComplete: () => void) {
  const hero = document.getElementById("home");
  if (!hero) throw new Error("Missing invitation destination");
  const stage = document.createElement("div");
  stage.className = "invitation-morph";
  stage.setAttribute("aria-hidden", "true");
  const hidden: { element: HTMLElement; visibility: string }[] = [];
  const faded: { element: HTMLElement; opacity: string }[] = [];
  const conceal = (element: HTMLElement) => {
    hidden.push({ element, visibility: element.style.visibility });
    element.style.visibility = "hidden";
  };
  const timeline = gsap.timeline({ paused: true, onComplete });
  const restore = () => {
    for (const { element, visibility } of hidden) element.style.visibility = visibility;
  };
  const cleanup = () => {
    timeline.kill();
    restore();
    for (const { element, opacity } of faded) element.style.opacity = opacity;
    stage.remove();
  };

  try {
    document.body.append(stage);
    // Read both layouts before hiding any originals or starting the flight.
    const pairs = keys.map(key => {
      const source = opening.querySelector<HTMLElement>(`[data-morph="${key}"]`);
      const target = hero.querySelector<HTMLElement>(`[data-morph="${key}"]`);
      if (!source || !target) throw new Error(`Missing shared element: ${key}`);
      return { key, source, target };
    });

    for (const { key, source, target } of pairs) {
      const targetStyle = getComputedStyle(target);
      const targetRect = target.getBoundingClientRect();
      const width = parseFloat(targetStyle.width) || target.offsetWidth;
      const height = parseFloat(targetStyle.height) || target.offsetHeight;
      const tilt = parseFloat(targetStyle.rotate) || 0;
      const wrapper = document.createElement("div");
      wrapper.className = "invitation-morph-item";
      wrapper.dataset.morphKey = key;
      wrapper.style.width = `${width}px`;
      wrapper.style.height = `${height}px`;
      const copy = target.cloneNode(true) as HTMLElement;
      copyTypography(target, copy);
      for (const node of [copy, ...Array.from(copy.querySelectorAll<HTMLElement>("*"))]) {
        node.removeAttribute("id");
        node.removeAttribute("class");
        node.removeAttribute("tabindex");
        node.removeAttribute("data-morph");
      }
      Object.assign(copy.style, { display: "block", width: "100%", height: "100%", margin: "0", padding: "0", transform: "none", rotate: "none" });
      if (copy instanceof HTMLImageElement) {
        copy.src = (target as HTMLImageElement).currentSrc;
        copy.removeAttribute("srcset");
        copy.removeAttribute("sizes");
        copy.loading = "eager";
      }
      wrapper.append(copy);
      stage.append(wrapper);

      // Capture the final viewport pose without normalizing/mutating the real
      // hero's independent CSS rotate. Flip fits the temporary copy to its
      // source; the exact center-based destination preserves the painted tilt.
      const angle = tilt * Math.PI / 180;
      const destination = {
        x: targetRect.x + targetRect.width / 2 - Math.cos(angle) * width / 2 + Math.sin(angle) * height / 2,
        y: targetRect.y + targetRect.height / 2 - Math.sin(angle) * width / 2 - Math.cos(angle) * height / 2,
        rotation: tilt,
        scaleX: 1,
        scaleY: 1,
      };
      Flip.fit(wrapper, source, { scale: true });

      if (source instanceof HTMLImageElement && artworkPath(source) !== artworkPath(target as HTMLImageElement)) {
        const paintedSource = source.cloneNode() as HTMLImageElement;
        paintedSource.src = source.currentSrc;
        paintedSource.removeAttribute("class");
        paintedSource.removeAttribute("srcset");
        paintedSource.removeAttribute("sizes");
        paintedSource.removeAttribute("data-morph");
        Object.assign(paintedSource.style, { position: "absolute", inset: "0", width: "100%", height: "100%", margin: "0", transform: "none" });
        wrapper.append(paintedSource);
        timeline.fromTo(copy, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "sine.inOut" }, 0.08);
        timeline.to(paintedSource, { opacity: 0, duration: 0.35, ease: "sine.inOut" }, 0.08);
      }
      conceal(source);
      conceal(target);
      timeline.to(wrapper, { ...destination, duration: 1.65, ease: "power3.inOut" }, 0);
    }

    const reveal = (selector: string, start: number, duration: number) => {
      const elements = document.querySelectorAll<HTMLElement>(selector);
      for (const element of elements) faded.push({ element, opacity: element.style.opacity });
      timeline.fromTo(elements, { opacity: 0 }, { opacity: 1, duration, clearProps: "opacity", ease: "sine.out" }, start);
    };
    reveal(".site-header, #home .age-line, #home .hero-air-layer, #home .hero-cloud-layer, #home .hero-spark-depth", 0.5, 0.9);
    // Let the animals clear the reading area before revealing the lower copy.
    reveal("#home .hero-description", 0.95, 0.65);
    reveal("#home .hero-date, #home .scroll-cue", 1.15, 0.5);
    faded.push({ element: opening, opacity: opening.style.opacity });
    timeline.to(opening, { opacity: 0, duration: 0.9, ease: "sine.inOut" }, 0);
    timeline.call(restore, [], 1.65);
    return { timeline, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}
