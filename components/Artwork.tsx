import Image from "next/image";
export function Character({
  kind,
  className = "",
  priority = false,
  src,
}: {
  kind: "lion" | "kitten";
  className?: string;
  priority?: boolean;
  src?: string;
}) {
  return (
    <div className={`character ${kind} ${className}`}>
      <Image
        src={src ?? `/art/${kind}.webp`}
        alt={
          kind === "lion"
            ? "Акварельне левеня з короною та блакитним бантиком"
            : "Пухнасте кошеня з рожевим бантиком"
        }
        width={kind === "lion" ? 760 : 720}
        height={kind === "lion" ? 695 : 786}
        priority={priority}
        sizes="(max-width: 600px) 44vw, (max-width: 1000px) 30vw, 360px"
      />
    </div>
  );
}
export function Star({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`drawn-star ${className}`}
      viewBox="0 0 40 40"
      aria-hidden="true"
    >
      <path
        d="m20 3 5.1 10.8L37 16l-8.7 8.6 1.9 12.1L20 31l-10.2 5.7 1.9-12.1L3 16l11.9-2.2Z"
        fill="currentColor"
        stroke="#d8ad68"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="m18 10-3 8-7 1"
        fill="none"
        stroke="#fff6da"
        strokeWidth="2"
        opacity=".8"
      />
    </svg>
  );
}
export function Butterfly({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`butterfly ${className}`}
      viewBox="0 0 70 55"
      aria-hidden="true"
    >
      <g fill="#edb6c3" stroke="#b88280" strokeWidth=".8">
        <path d="M34 29C13-16-9 7 9 28 16 36 27 34 34 29Z" />
        <path d="M34 29C4 24 9 55 25 46 32 42 34 36 34 29Z" />
        <path d="M35 29C52-12 81 2 62 25 54 35 45 32 35 29Z" />
        <path d="M35 29C67 23 63 57 46 46 38 41 36 35 35 29Z" />
      </g>
      <path
        d="m34 42 1-21m0 0-5-8m5 8 6-9"
        fill="none"
        stroke="#84644e"
        strokeWidth="1.5"
      />
      <path
        d="M30 27 12 12m26 13L60 9"
        stroke="#fff5ea"
        strokeWidth="1.5"
        opacity=".75"
      />
    </svg>
  );
}
export function Balloon({
  color = "blue",
  children,
  className = "",
}: {
  color?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`balloon ${color} ${className}`}>
      <div className="balloon-body">
        {children}
        <span className="balloon-glint" />
      </div>
      <svg className="balloon-string" viewBox="0 0 50 110" aria-hidden="true">
        <path
          d="M25 0C-5 35 57 50 25 79S26 102 26 110"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}
export function Ribbon({ className = "" }: { className?: string }) {
  return (
    <Image
      className={`ribbon-bow ${className}`}
      src="/art/satin-bow.webp"
      alt=""
      width={640}
      height={640}
      sizes="(max-width: 767px) 100px, 200px"
    />
  );
}

export function CelebrationThread({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`celebration-thread ${className}`}
      viewBox="0 0 230 42"
      aria-hidden="true"
    >
      <path
        d="M6 26C34 7 73 34 105 22S169 9 224 23"
        fill="none"
        stroke="#cbb396"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="m72 9 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"
        fill="#d4e6ef"
        stroke="#92afbe"
        strokeWidth=".9"
      />
      <path
        d="m163 10 2 5 6 1-4 4 1 6-5-3-5 3 1-6-4-4 6-1Z"
        fill="#f2d6e0"
        stroke="#cca0ad"
        strokeWidth=".9"
      />
    </svg>
  );
}

export function PearlBalloon({
  color = 0,
  className = "",
}: {
  color?: number;
  className?: string;
}) {
  return (
    <div className={`pearl-balloon ${className}`} aria-hidden="true">
      <div
        className="pearl-balloon-art"
        style={{
          backgroundPosition: `${(color % 3) * 50}% ${color < 3 ? 0 : 100}%`,
        }}
      >
        <span className="pearl-balloon-head" />
        <span className="pearl-balloon-tail" />
      </div>
    </div>
  );
}
