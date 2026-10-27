"use client";

import { useLayoutEffect, useRef } from "react";
import { getImageProps } from "next/image";

const characters = (["lion", "kitten"] as const).map(kind => ({
  kind,
  ...getImageProps({
    src: kind === "lion" ? "/art/lion-opening-close.webp" : "/art/kitten.webp",
    alt: kind === "lion" ? "Акварельне левеня з короною та блакитним бантиком" : "Акварельне кошеня з рожевим бантиком",
    width: kind === "lion" ? 760 : 720,
    height: kind === "lion" ? 695 : 786,
    sizes: "(max-width: 600px) 50vw, (max-width: 1100px) 280px, 640px",
  }),
}));

/** These two DOM images live for the whole invitation, including every replay.
 * Empty layout anchors belong to React; the travelling visual belongs here. */
export default function SharedInvitationCharacters({ opening }: { opening: boolean }) {
  const visuals = useRef(new Map<string, HTMLSpanElement>());

  useLayoutEffect(() => {
    const hosts = visuals.current;
    for (const { kind, props } of characters) {
      const host = document.createElement("span");
      host.className = "shared-character-visual";
      host.dataset.sharedCharacter = kind;
      const image = document.createElement("img");
      image.alt = props.alt;
      image.width = Number(props.width);
      image.height = Number(props.height);
      image.decoding = "async";
      image.loading = "eager";
      image.fetchPriority = "high";
      if (props.sizes) image.sizes = props.sizes;
      if (props.srcSet) image.srcset = props.srcSet;
      image.src = props.src;
      host.append(image);
      hosts.set(kind, host);
    }
    return () => {
      for (const host of hosts.values()) host.remove();
      hosts.clear();
    };
  }, []);

  useLayoutEffect(() => {
    for (const [kind, host] of visuals.current) {
      // Morph owns the visual until its final paint. A fresh replay can take
      // it back immediately without creating or decoding another image.
      if (!opening && host.closest(".invitation-morph")) continue;
      document.querySelector(`[data-character-anchor="${opening ? "opening" : "hero"}-${kind}"]`)?.append(host);
    }
  }, [opening]);

  return <>{characters.map(({ kind, props }) => (
    <link key={kind} rel="preload" as="image" imageSrcSet={props.srcSet} imageSizes={props.sizes} fetchPriority="high" />
  ))}</>;
}
