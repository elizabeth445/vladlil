import type { ArtBox, Eye } from "@/lib/character-anatomy";

// The eyelids borrow a clean fur patch from the SAME head. No alternate head,
// flat skin-colored ovals, changing muzzle, or extra raster files are needed.
export default function CharacterEyes({ id, eyes, texture, lash, headSource, src }: {
  id: string;
  eyes: readonly Eye[];
  texture: ArtBox;
  lash: string;
  headSource: { width: number; height: number };
  src: string;
}) {
  return <g className="rig-eyes" aria-hidden="true">
    {eyes.map((eye, index) => <g key={index} data-eye-radius-x={eye.rx + 5} data-eye-radius-y={eye.ry + 5} transform={`translate(${eye.cx} ${eye.cy}) rotate(${eye.angle})`}>
      <defs>
        <filter id={`${id}-eye-soft-${index}`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.1" /></filter>
        <mask id={`${id}-eye-${index}`} maskUnits="userSpaceOnUse" x={-eye.rx - 5} y={-eye.ry - 5} width={eye.rx * 2 + 10} height={eye.ry * 2 + 10}>
          <ellipse rx={eye.rx} ry={eye.ry} fill="white" filter={`url(#${id}-eye-soft-${index})`} />
        </mask>
      </defs>
      <g mask={`url(#${id}-eye-${index})`}>
        <g className="rig-lid-motion" data-eye-top={-eye.ry - 5}>
          <svg x={-eye.rx - 5} y={-eye.ry - 5} width={2 * eye.rx + 10} height={2 * eye.ry + 10}
            viewBox={`${texture.x} ${texture.y} ${texture.width} ${texture.height}`} preserveAspectRatio="xMidYMid slice" overflow="hidden">
            <image href={src} width={headSource.width} height={headSource.height} />
          </svg>
        </g>
        <path className="rig-lash" d={`M${-eye.rx * .75} 4Q0 ${-eye.ry * .15} ${eye.rx * .75} 4`}
          fill="none" stroke={lash} strokeWidth="2.8" strokeLinecap="round" />
      </g>
    </g>)}
  </g>;
}
