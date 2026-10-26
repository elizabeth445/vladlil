"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { Music2 } from "lucide-react";

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
      <Music2 size={22} aria-hidden="true" />
      {muted ? <span className="music-muted-slash" aria-hidden="true" /> : null}
    </button>
  );
}
