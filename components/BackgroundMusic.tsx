"use client";

import { useEffect, useId, useRef, useState } from "react";

export function useBackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const mounted = useRef(false);
  const [playing, setPlaying] = useState(false);

  const play = () => {
    const audio = audioRef.current;
    if (!audio || document.visibilityState === "hidden") return;
    audio.volume = 0.35;
    // Call play synchronously inside the envelope's trusted click/tap. Delaying
    // it until the animation completes loses the audio permission on iOS.
    void audio.play().catch(() => {
      if (mounted.current) setPlaying(!audio.paused && !audio.ended && !audio.error);
    });
  };
  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) play();
    else audio.pause();
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    mounted.current = true;
    const stop = () => {
      audio.pause();
      setPlaying(false);
    };
    const sync = () => {
      if (document.visibilityState === "hidden") { stop(); return; }
      setPlaying(!audio.paused && !audio.ended && !audio.error);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") stop();
    };
    const onRestore = (event: PageTransitionEvent) => {
      if (event.persisted) stop();
    };
    for (const event of ["playing", "pause", "ended", "error"]) audio.addEventListener(event, sync);
    // Mobile browsers often only emit visibilitychange when the tab/app is
    // closed. Stop on both lifecycle paths; returning never starts music.
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", stop);
    window.addEventListener("pageshow", onRestore);
    return () => {
      mounted.current = false;
      for (const event of ["playing", "pause", "ended", "error"]) audio.removeEventListener(event, sync);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", stop);
      window.removeEventListener("pageshow", onRestore);
      audio.pause();
    };
  }, []);

  // Opening the envelope always starts the music, including after a previous
  // visit was muted. Pausing during this visit stays in effect while scrolling.
  return { audioRef, muted: !playing, start: play, toggle };
}

export function MusicToggle({
  muted,
  onToggle,
}: {
  muted: boolean;
  onToggle: () => void;
}) {
  const noteGradient = useId();
  const label = muted ? "Увімкнути музику" : "Вимкнути музику";
  return (
    <button
      type="button"
      className="music-toggle"
      aria-label={label}
      title={label}
      aria-pressed={!muted}
      onClick={onToggle}
    >
      <svg className="music-note" viewBox="0 0 34 38" width="27" height="30" aria-hidden="true">
        <defs>
          <linearGradient id={noteGradient} x1="3" y1="34" x2="30" y2="4" gradientUnits="userSpaceOnUse">
            <stop stopColor="#e8a6b9" />
            <stop offset=".5" stopColor="#c7b3d7" />
            <stop offset="1" stopColor="#88bfd6" />
          </linearGradient>
        </defs>
        <g fill={`url(#${noteGradient})`} stroke="#b795aa" strokeWidth=".45" strokeLinejoin="round">
          <ellipse cx="7.8" cy="30.2" rx="5.8" ry="4.4" transform="rotate(-18 7.8 30.2)" />
          <ellipse cx="25" cy="25.6" rx="5.8" ry="4.4" transform="rotate(-18 25 25.6)" />
          <path d="M11 8.3 28 4a1.6 1.6 0 0 1 2 1.6v19.5h-3V12l-13.2 3.4v14.3h-3V10a1.7 1.7 0 0 1 1.2-1.7Z" />
        </g>
        <path d="m12.1 9.3 15.6-3.9M4.5 29.7c1.1-1.1 2.4-1.5 3.6-1.6m13.3-3c1.1-1 2.3-1.4 3.5-1.5" fill="none" stroke="#fff9f5" strokeWidth=".85" strokeLinecap="round" opacity=".7" />
      </svg>
      {muted ? <span className="music-muted-slash" aria-hidden="true" /> : null}
    </button>
  );
}
