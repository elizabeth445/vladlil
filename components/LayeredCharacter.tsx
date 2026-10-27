"use client";

import { forwardRef, useId, useImperativeHandle, useRef } from "react";
import { CHARACTER_ANATOMY, type ArtBox, type CharacterKind } from "@/lib/character-anatomy";
import CharacterEyes from "./CharacterEyes";
import { useCharacterMotion, type CharacterHandle } from "./useCharacterMotion";
export type { CharacterHandle } from "./useCharacterMotion";

const LayeredCharacter = forwardRef<CharacterHandle, {
  kind: CharacterKind;
  className?: string;
  priority?: boolean;
  autoWave?: boolean;
}>(function LayeredCharacter({ kind, className = "", priority = false, autoWave = false }, ref) {
  const root = useRef<HTMLSpanElement>(null);
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const rig = CHARACTER_ANATOMY[kind];
  const motion = useCharacterMotion(root, kind, autoWave, priority);
  useImperativeHandle(ref, () => ({ wave: () => motion.current?.wave() }), [motion]);
  const src = (part: string) => `/art/characters/${kind}/${part}.png`;
  const art = (part: string, rect: ArtBox, mirror = false) => <image
    href={src(part)} {...rect} preserveAspectRatio="xMidYMid meet"
    transform={mirror ? `translate(${2 * rect.x + rect.width} 0) scale(-1 1)` : undefined}
  />;
  const torso = (front: boolean) => <g className="rig-body-compensation">
    <g className="rig-body-breath">
      <g mask={`url(#${id}-body-silhouette)`} clipPath={front ? `url(#${id}-chest)` : undefined}>{art("body", rig.body)}</g>
    </g>
  </g>;
  const planted = autoWave ? (rig.wave.side === "right" ? rig.frontLeft : rig.frontRight) : null;

  return <span ref={root} className={`character-rig rig-${kind} ${className}`}
    aria-hidden="true" data-character-scene={autoWave ? "closing" : "hero"}
    data-wave-state="idle" data-idle-running="false" data-art-ready="false" data-blink-state="open">
    <svg className="rig-artwork" viewBox="0 0 100 100" focusable="false">
      <defs>
        <clipPath id={`${id}-chest`}><path d={rig.chest} /></clipPath>
        <filter id={`${id}-belly-edge`} x="0" y="0" width="100%" height="100%"><feGaussianBlur stdDeviation=".18" /></filter>
        <mask id={`${id}-body-silhouette`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect width="100" height="100" fill="white" />
          <path d={rig.bellyCut} fill="black" filter={`url(#${id}-belly-edge)`} />
        </mask>
      </defs>
      <g transform={`rotate(${rig.tail.restAngle} ${rig.tail.root.x} ${rig.tail.root.y})`}>
        <g className="rig-tail">{art("tail", rig.tail.box)}</g>
      </g>
      <g className="rig-hindquarters">{torso(false)}</g>
      {autoWave ? <g className="rig-shoulder" data-shoulder-x={rig.wave.shoulder.x} data-shoulder-y={rig.wave.shoulder.y}>
        {art("paw-wave-bent", rig.wave.box, rig.wave.mirror)}
      </g> : null}
      {/* Chest fur occludes the upper arm's inner root; the elbow remains in
          front of the hindquarters. This is an anatomical overlap, not a crop. */}
      <g className="rig-chest">{torso(true)}</g>
      {planted ? <g className="rig-grounded-front">{art("paw-rest", planted)}</g> : <>
        <g className="rig-grounded-front">{art("paw-rest", rig.frontLeft)}</g>
        <g className="rig-grounded-front">{art("paw-rest", rig.frontRight)}</g>
      </>}
      <g className="rig-head-idle"><g className="rig-head-gesture">
        <svg className="rig-head" {...rig.head} viewBox={`0 0 ${rig.headSource.width} ${rig.headSource.height}`} overflow="visible">
          <image href={src("head-open")} width={rig.headSource.width} height={rig.headSource.height} />
          <CharacterEyes id={id} eyes={rig.eyes} texture={rig.eyelid.texture} lash={rig.eyelid.lash} headSource={rig.headSource} src={src("head-open")} />
        </svg>
      </g></g>
    </svg>
  </span>;
});
export default LayeredCharacter;
