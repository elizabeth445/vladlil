"use client";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarPlus,
  MailCheck,
  LoaderCircle,
} from "lucide-react";
import FlyingPaperPlane from "./FlyingPaperPlane";
import { Ribbon } from "./Artwork";
import { readDraft, saveDraft } from "@/lib/browser-drafts";
import { useFormSubmission } from "./useFormSubmission";

export default function RSVP() {
  const { status, error, submit: send } = useFormSubmission();
  const [guestName, setGuestName] = useState("");
  const [attending, setAttending] = useState("yes");
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const draft = readDraft("birthday:rsvp:v1", { guest_name: 200, attending: 3, guests: 2, comment: 1500 });
    const timer = setTimeout(() => {
      if (!formRef.current) return;
      if (draft.attending === "yes" || draft.attending === "no") setAttending(draft.attending);
      for (const field of ["guest_name", "guests", "comment"]) {
        const element = formRef.current.elements.namedItem(field);
        if (draft[field] !== undefined && (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) element.value = draft[field];
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  function persistDraft(form: HTMLFormElement) {
    const data = new FormData(form);
    return saveDraft("birthday:rsvp:v1", {
      guest_name: String(data.get("guest_name") || ""),
      attending: String(data.get("attending") || "yes"),
      guests: String(data.get("guests") || "1"),
      comment: String(data.get("comment") || ""),
    });
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (await send({ type: "rsvp", website: String(form.get("website") || ""),
      guest_name: String(form.get("guest_name") || ""), attending: attending === "yes",
      guests: attending === "yes" ? Number(form.get("guests")) : 1,
      comment: String(form.get("comment") || ""),
    })) {
      setGuestName(String(form.get("guest_name") || "").trim());
    }
  }
  return (
    <section id="rsvp" className="rsvp-section section">
      <div className="rsvp-copy">
        <FlyingPaperPlane />
        <h2>
          Ви будете
          <br />з нами?
        </h2>
        <p>
          Нам буде дуже приємно
          <br />
          святкувати цей день разом із вами!
        </p>
        <span className="handwritten">Обійми вже приготували.</span>
      </div>
      {status === "success" ? (
        <div className="rsvp-success" role="status">
          <Ribbon className="rsvp-success-bow" />
          <MailCheck
            className="rsvp-success-seal"
            size={34}
            aria-hidden="true"
          />
          <p className="rsvp-confirmation-note">Дякуємо за відповідь!</p>
          <h3>
            {attending === "yes" ? "Чекаємо на вас," : "Дякуємо за тепло,"}
            <span>{guestName}!</span>
          </h3>
          <p>
            {attending === "yes"
              ? "Ваше місце на нашому святі вже чекає. До зустрічі й найтепліших обіймів!"
              : "Нам шкода, що не зустрінемося цього разу. Відчуваємо ваше тепло навіть на відстані."}
          </p>
          {attending === "yes" ? (
            <>
              <div className="rsvp-confirmed-date">
                <strong>15 листопада</strong>
                <span>16:00 · Ресторан FRANCO</span>
              </div>
              <a
                href="/api/calendar"
                download="birthday-2026.ics"
                className="button secondary"
              >
                <CalendarPlus size={18} /> Зберегти дату
              </a>
            </>
          ) : null}
          <span className="rsvp-signature">З любов’ю, Владислав та Лілія</span>
        </div>
      ) : (
        <form ref={formRef} className="rsvp-form" onSubmit={submit} aria-busy={status === "loading"} onChange={(e) => {
          persistDraft(e.currentTarget);
        }}>
          <fieldset disabled={status === "loading"}>
            <legend className="sr-only">Підтвердьте присутність</legend>
            <label htmlFor="rsvp-name">Ім’я та прізвище</label>
            <input
              id="rsvp-name"
              name="guest_name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={200}
              placeholder="Як до вас звертатися?"
            />
            <div className="honey" aria-hidden="true">
              <label htmlFor="rsvp-website">Ваш сайт</label>
              <input
                id="rsvp-website"
                name="website"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
            <fieldset className="attendance">
              <legend>Чи будете ви на святі?</legend>
              <label>
                <input
                  type="radio"
                  name="attending"
                  value="yes"
                  checked={attending === "yes"}
                  onChange={(e) => setAttending(e.target.value)}
                />
                Так, із радістю!
              </label>
              <label>
                <input
                  type="radio"
                  name="attending"
                  value="no"
                  checked={attending === "no"}
                  onChange={(e) => setAttending(e.target.value)}
                />
                На жаль, не зможу
              </label>
            </fieldset>
            {attending === "yes" ? (
              <>
                <label htmlFor="rsvp-guests">
                  Кількість гостей разом із вами
                </label>
                <select id="rsvp-guests" name="guests" defaultValue="1">
                  {Array.from({ length: 20 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <label htmlFor="rsvp-comment">
              Коментар <span>(необов’язково)</span>
            </label>
            <textarea
              id="rsvp-comment"
              name="comment"
              rows={2}
              maxLength={1500}
              placeholder="Можливо, ви хочете щось додати…"
            />
            <button className="button" disabled={status === "loading"}>
              {status === "loading" ? (
                <>
                  <LoaderCircle className="spin" size={17} />
                  Надсилаємо…
                </>
              ) : (
                <>
                  Надіслати відповідь
                  <ArrowRight size={18} />
                </>
              )}
            </button>
            <p className="privacy-note">Відповіді приватно надсилаються організаторам свята через Telegram.</p>
            <div role="alert" className="form-message">
              {error}
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
