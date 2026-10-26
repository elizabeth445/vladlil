"use client";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import {
  ArrowRight,
  Check,
  Heart,
  LoaderCircle,
  Mail,
  Send,
} from "lucide-react";
import { answerKeys, CHILDREN, type Child } from "@/lib/event";
import { submissionsEnabled } from "@/lib/features";
import { readDraft, saveDraft } from "@/lib/browser-drafts";
import {
  Character,
  Butterfly,
  Star,
  Ribbon,
  CelebrationThread,
} from "./Artwork";
gsap.registerPlugin(useGSAP);
const emptyAnswers = () =>
  Object.fromEntries(answerKeys.map((k) => [k, ""])) as Record<
    (typeof answerKeys)[number],
    string
  >;
function LetterForm({
  child,
  active,
  onOther,
}: {
  child: Child;
  active: boolean;
  onOther: () => void;
}) {
  const data = CHILDREN[child];
  const [answers, setAnswers] = useState(emptyAnswers);
  const [status, setStatus] = useState<
    "idle" | "loading" | "error" | "success"
  >("idle");
  const [error, setError] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [trap, setTrap] = useState("");
  const requestId = useRef<string | null>(null);
  const started = useRef(0);
  const panel = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    started.current = Date.now();
    const draft = readDraft(`birthday:letter:${child}:v1`, {
      identity: 200, resemblance: 1500, character: 1500, future: 1500, wishes: 1500,
    });
    const timer = setTimeout(() => setAnswers(current => ({ ...current, ...draft })), 0);
    return () => clearTimeout(timer);
  }, [child]);
  useGSAP(
    () => {
      if (!active || !panel.current) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          panel.current,
          { rotationX: -7, opacity: 0.5, y: 12 },
          {
            rotationX: 0,
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: "power2.out",
            transformOrigin: "50% 0%",
          },
        );
        if (status === "success")
          gsap.from(".success-envelope", {
            rotation: -8,
            scale: 0.8,
            opacity: 0,
            duration: 0.6,
            ease: "back.out(1.4)",
          });
      });
      return () => mm.revert();
    },
    {
      scope: panel,
      dependencies: [active, status === "success"],
      revertOnUpdate: true,
    },
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "loading") return;
    if (!submissionsEnabled) {
      const saved = saveDraft(`birthday:letter:${child}:v1`, answers);
      setDraftMessage(saved
        ? "Чернетку збережено на цьому пристрої. Організаторам її не надіслано."
        : "Браузер не дозволив зберегти чернетку. Ваш текст залишається у формі.");
      return;
    }
    setStatus("loading");
    setError("");
    requestId.current ||= crypto.randomUUID();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch("/api/letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          child,
          answers,
          website: trap,
          started_at: started.current,
          request_id: requestId.current,
        }),
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok || result.saved !== true)
        throw new Error(
          result.error || "Не вдалося зберегти лист. Спробуйте ще раз.",
        );
      setStatus("success");
    } catch (err) {
      setError(
        err instanceof Error && err.name !== "AbortError"
          ? err.message
          : "Немає зв’язку із сервером. Ваш текст залишився у формі. Спробуйте ще раз.",
      );
      setStatus("error");
    } finally {
      clearTimeout(timeout);
    }
  }
  useEffect(() => {
    if (status === "success") statusRef.current?.focus();
  }, [status]);
  return (
    <div
      hidden={!active}
      id={`panel-${child}`}
      role="tabpanel"
      aria-labelledby={`tab-${child}`}
      ref={panel}
      className={`letter-paper ${data.color}`}
    >
      {status === "success" ? (
        <div
          className="letter-success"
          ref={statusRef}
          tabIndex={-1}
          role="status"
        >
          <div className="success-envelope">
            <Mail size={74} />
            <Check size={24} />
          </div>
          <Character kind={data.art} />
          <h3>
            Теплі слова —<br />у скриньці спогадів
          </h3>
          <p>
            Дякуємо! Ваш лист для {data.recipient} збережено{" "}
            {child === "vladyslav" ? "💙" : "💗"}
          </p>
          <button className="button secondary" onClick={onOther}>
            Написати ще один лист <ArrowRight size={17} />
          </button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <header className="letter-heading">
            <div>
              <span className="letter-to">
                Для {data.name === "Лілія" ? "Лілії" : "Владислава"} з любов’ю
              </span>
              <h3>Анкета гостя</h3>
              <p>{data.intro}</p>
            </div>
            <Character kind={data.art} />
          </header>
          {!submissionsEnabled && <p className="draft-note">Поки що можна зберегти чернетку на своєму пристрої. Надсилання листів ще не відкрито.</p>}
          <div className="honey" aria-hidden="true">
            <label htmlFor={`website-${child}`}>Ваш сайт</label>
            <input
              tabIndex={-1}
              autoComplete="off"
              id={`website-${child}`}
              value={trap}
              onChange={(e) => setTrap(e.target.value)}
            />
          </div>
          <fieldset disabled={status === "loading"} className="question-fields">
            <legend className="sr-only">Лист для {data.recipient}</legend>
            {answerKeys.map((key, i) => (
              <div className="question" key={key}>
                <label htmlFor={`${child}-${key}`}>
                  <span className="question-mark" aria-hidden="true">
                    {child === "vladyslav" ? <Star /> : <Heart size={18} />}
                  </span>
                  {data.questions[i]}
                </label>
                <textarea
                  id={`${child}-${key}`}
                  name={key}
                  required
                  minLength={2}
                  maxLength={i === 0 ? 200 : 1500}
                  rows={i === 4 ? 4 : 2}
                  value={answers[key]}
                  onChange={(e) => {
                    const next = { ...answers, [key]: e.target.value };
                    setAnswers(next);
                    saveDraft(`birthday:letter:${child}:v1`, next);
                    setDraftMessage("");
                  }}
                  placeholder={
                    i === 0
                      ? "Ваше ім’я та кілька слів про себе…"
                      : "Ваші теплі слова…"
                  }
                />
              </div>
            ))}
          </fieldset>
          <div className="letter-bottom">
            <Heart size={25} />
            <p>{data.closing}</p>
            <button
              className="button"
              type="submit"
              disabled={status === "loading"}
            >
              {status === "loading" ? (
                <>
                  <LoaderCircle className="spin" size={18} />
                  Зберігаємо лист…
                </>
              ) : (
                <>
                  {submissionsEnabled ? `Зберегти лист для ${data.recipient}` : "Зберегти чернетку на пристрої"}
                  <Send size={17} />
                </>
              )}
            </button>
            <div className="form-message" role="alert">
              {error}
            </div>
            {!submissionsEnabled && <p className="draft-note" role="status">{draftMessage}</p>}
          </div>
        </form>
      )}
    </div>
  );
}
export default function Letters() {
  const [active, setActive] = useState<Child | null>(null);
  const tabs = useRef<HTMLDivElement>(null);
  const select = (child: Child) => {
    setActive(child);
  };
  return (
    <section id="letters" className="letters-section section">
      <div className="section-heading">
        <CelebrationThread />
        <h2>Листи у майбутнє</h2>
        <p>
          Залиште теплі слова нашим іменинникам. Ваші відповіді стануть
          <br className="desktop-break" /> особливими спогадами, які ми
          збережемо на довгі роки.
        </p>
      </div>
      <div
        className="letter-choices"
        role="tablist"
        aria-label="Оберіть іменинника"
        ref={tabs}
      >
        {(["vladyslav", "liliia"] as const).map((child, i) => (
          <button
            key={child}
            id={`tab-${child}`}
            role="tab"
            aria-selected={active === child}
            aria-controls={`panel-${child}`}
            tabIndex={active === null || active === child ? 0 : -1}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                const next = (["vladyslav", "liliia"] as const)[1 - i];
                select(next);
                document.getElementById(`tab-${next}`)?.focus();
              }
            }}
            className={`letter-choice ${CHILDREN[child].color} ${active === child ? "selected" : ""}`}
            onClick={() => select(child)}
          >
            <Character kind={CHILDREN[child].art} />
            <div className="mini-envelope" aria-hidden="true">
              <Heart size={17} fill="currentColor" />
            </div>
            <span className="choice-label">
              <span>Лист для</span>
              <strong>{CHILDREN[child].recipient}</strong>
            </span>
            <span className="choice-action">
              {active === child ? "Лист відкрито" : "Відкрити лист"}
              <ArrowRight size={17} />
            </span>
            {child === "liliia" ? <Butterfly /> : <Star />}
          </button>
        ))}
      </div>
      {active === null ? (
        <p className="letter-hint">
          Оберіть конверт, щоб залишити частинку свого тепла.
        </p>
      ) : null}
      <div className="letters-panels">
        <LetterForm
          child="vladyslav"
          active={active === "vladyslav"}
          onOther={() => select("liliia")}
        />
        <LetterForm
          child="liliia"
          active={active === "liliia"}
          onOther={() => select("vladyslav")}
        />
      </div>
      <Ribbon className="letters-ribbon-bow" />
    </section>
  );
}
