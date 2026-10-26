"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

const Agentation = dynamic(
  () => import("agentation").then((module) => module.Agentation),
  { ssr: false },
);

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

function isEnabled() {
  return (
    process.env.NODE_ENV === "development" ||
    new URLSearchParams(window.location.search).get("edit") === "1"
  );
}

export default function DevelopmentTools() {
  const enabled = useSyncExternalStore(subscribe, isEnabled, () => false);
  if (!enabled) return null;

  return (
    <Agentation appName="Владислав та Лілія" enableKeyboardShortcuts={false} />
  );
}
