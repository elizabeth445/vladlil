"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";

const PREFERENCE = "invitation-music-muted";
const CHANGE_EVENT = "invitation-music-change";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useBackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const fallbackMuted = useRef<boolean | null>(null);
  const isMuted = () => {
    if (fallbackMuted.current !== null) return fallbackMuted.current;
    try {
      return localStorage.getItem(PREFERENCE) === "true";
    } catch {
      return false;
    }
  };
  const muted = useSyncExternalStore(subscribe, isMuted, () => false);

  const setMuted = (value: boolean) => {
    try {
      localStorage.setItem(PREFERENCE, String(value));
      fallbackMuted.current = null;
    } catch {
      // The audio control still works when browser storage is unavailable.
      fallbackMuted.current = value;
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  const play = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.35;
    void audio.play().catch((error: unknown) => {
      if (!(error instanceof DOMException) || !["AbortError", "NotAllowedError"].includes(error.name)) {
        setMuted(true);
      }
    });
  };

  const start = () => {
    if (!isMuted()) play();
  };

  const toggle = () => {
    if (isMuted()) {
      setMuted(false);
      play();
    } else {
      audioRef.current?.pause();
      setMuted(true);
    }
  };

  useEffect(() => {
    if (muted) audioRef.current?.pause();
  }, [muted]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => audio?.pause();
  }, []);

  return { audioRef, muted, start, toggle };
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
