"use client";
import { useState } from "react";
import AnimatedCharacter from "@/components/AnimatedCharacter";
import styles from "./preview.module.css";

const backgrounds = [
  { name: "Білий", value: "#fff" }, { name: "Чорний", value: "#101014" },
  { name: "Рожевий", value: "#e3a9bd" }, { name: "Блакитний", value: "#73b8dd" },
  { name: "Градієнт", value: "linear-gradient(125deg,#739dc4,#edb4c5 55%,#e8d7aa)" },
  { name: "Фото", value: "url('/art/franco.webp') center / cover" },
];
export default function AnimationPreview() {
  const [background, setBackground] = useState(0);
  const [mode, setMode] = useState<"first" | "last" | "play">("first");
  const [run, setRun] = useState(0);
  const [fallback, setFallback] = useState(false);
  const [loop, setLoop] = useState(false);
  return <main className={styles.page}>
    <h1>Перевірка прозорості</h1>
    <p>Змініть фон під час руху. Натисніть на персонажа, щоб відтворити анімацію ще раз.</p>
    <div className={styles.controls} aria-label="Фон анімацій">{backgrounds.map((b, i) => <button key={b.name} type="button" aria-pressed={background === i} onClick={() => setBackground(i)}>{b.name}</button>)}</div>
    <div className={styles.controls}>
      {([['first', 'Перший кадр'], ['play', 'Відтворити'], ['last', 'Останній кадр']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => { setMode(value); setRun(v => v + 1); }}>{label}</button>)}
      <label><input type="checkbox" checked={fallback} onChange={e => { setFallback(e.target.checked); setRun(v => v + 1); }} /> Резервний WebP</label>
      <label><input type="checkbox" checked={loop} onChange={e => setLoop(e.target.checked)} /> Повторювати</label>
    </div>
    <div className={styles.scenes}>{(["lion", "kitten"] as const).map(kind => <section key={kind}>
      <h2>{kind === "lion" ? "Левеня" : "Кошеня"}</h2>
      <div className={styles.stage} style={{ background: backgrounds[background].value }}>
        <AnimatedCharacter key={`${kind}-${run}`} kind={kind} autoPlay={mode === "play"} initialFrame={mode === "last" ? "last" : "first"} format={fallback ? "webp" : "auto"} loop={loop} />
      </div>
    </section>)}</div>
  </main>;
}
