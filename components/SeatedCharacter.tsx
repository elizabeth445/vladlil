import Image from "next/image";

// Whole original artwork: paws stay in their painted resting pose.
export default function SeatedCharacter({ kind, priority = false }: {
  kind: "lion" | "kitten";
  priority?: boolean;
}) {
  return <span className={`seated-character seated-${kind}`}>
    <Image
      src={kind === "lion" ? "/art/lion-seated.webp" : "/art/kitten.webp"}
      alt={kind === "lion" ? "Акварельне левеня з опущеними лапками" : "Акварельне кошеня з опущеними лапками"}
      width={kind === "lion" ? 760 : 720}
      height={kind === "lion" ? 760 : 786}
      priority={priority}
      sizes="(max-width: 600px) 50vw, (max-width: 1100px) 280px, 400px"
    />
  </span>;
}
