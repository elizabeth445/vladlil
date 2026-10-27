"use client";
import { useEffect, useRef, useState } from "react";
import type { Submission } from "@/lib/validation";

type Payload = (Omit<Extract<Submission, { type: "rsvp" }>, "request_id" | "started_at" | "website"> |
  Omit<Extract<Submission, { type: "vladyslav" | "liliia" }>, "request_id" | "started_at" | "website">) & { website: string };

export function useFormSubmission() {
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const requestId = useRef<string | null>(null);
  const started = useRef(0);
  useEffect(() => { started.current = Date.now(); }, []);
  async function submit(payload: Payload) {
    if (inFlight.current || status === "success") return false;
    inFlight.current = true;
    setStatus("loading"); setError("");
    requestId.current ||= crypto.randomUUID();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 28000);
    try {
      const response = await fetch("/api/submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, request_id: requestId.current, started_at: started.current }),
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok || result.delivered !== true) throw new Error(result.error || "Не вдалося підтвердити доставку. Ваш текст залишився у формі.");
      setStatus("success");
      return true;
    } catch (err) {
      setError(err instanceof Error && err.name !== "AbortError" && !(err instanceof TypeError) && !(err instanceof SyntaxError)
        ? err.message : "Немає підтвердження доставки. Ваші відповіді залишилися у формі. Перед повтором перевірте з організаторами, чи вони надійшли.");
      setStatus("error");
      return false;
    } finally {
      clearTimeout(timeout); inFlight.current = false;
    }
  }
  return { status, error, submit };
}
