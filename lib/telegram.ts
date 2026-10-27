import { answerKeys, CHILDREN } from "./event";
import type { Submission } from "./validation";

export type TelegramConfig = { token: string; chatIds: readonly string[] };
export class TelegramDeliveryError extends Error {
  constructor(readonly sentParts: number, readonly uncertain: boolean, readonly retryAfter?: number) {
    super("TELEGRAM_DELIVERY_FAILED");
  }
}

// Only our labels use HTML. Escape every guest value so it remains plain text.
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function telegramMessages(data: Submission, now = new Date()): string[] {
  const title = data.type === "rsvp" ? "🎂 RSVP — підтвердження присутності"
    : `${data.type === "vladyslav" ? "🦁" : "🐱"} Анкета гостя для ${CHILDREN[data.type].recipient}`;
  const name = (data.type === "rsvp" ? data.guest_name : data.answers.identity).replace(/\s+/g, " ");
  const time = new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv", dateStyle: "long", timeStyle: "medium",
  }).format(now);
  const header = `<b>${escapeHtml(title)}</b>\n\n👤 <b>Гість:</b> ${escapeHtml(name)}\n🕒 <b>Надіслано:</b> ${escapeHtml(time)} (Київ)`;
  const headerLength = `${title}\n\n👤 Гість: ${name}\n🕒 Надіслано: ${time} (Київ)`.length;
  const block = (icon: string, question: string, answer: string) => ({
    html: `${icon} <b>${escapeHtml(question)}</b>\n${escapeHtml(answer)}`,
    length: `${icon} ${question}\n${answer}`.length,
  });
  const blocks = data.type === "rsvp" ? [
    block("👤", "Ім’я та прізвище", data.guest_name),
    block("📅", "Чи будете ви на святі?", data.attending ? "Так, із радістю!" : "На жаль, не зможу"),
    block("👥", "Кількість гостей разом із вами", String(data.attending ? data.guests : 0)),
    block("💬", "Коментар", data.comment || "Не вказано"),
  ] : answerKeys.map((key, index) => block(["👋", "👨‍👩‍👧‍👦", "✨", "🌟", "💌"][index], CHILDREN[data.type as "vladyslav" | "liliia"].questions[index], data.answers[key]));
  // A whole answer (max 1500 UTF-16 units) fits in one part. Pack complete
  // questions in order, leaving room for the repeated header and part count.
  // Telegram's limit applies after entity parsing, not to encoded HTML bytes.
  const budget = 4000 - headerLength - 40;
  const parts: string[] = [];
  let current = "", length = 0;
  for (const block of blocks) {
    if (current && length + block.length + 2 > budget) {
      parts.push(current);
      current = ""; length = 0;
    }
    length += (current ? 2 : 0) + block.length;
    current += `${current ? "\n\n" : ""}${block.html}`;
  }
  if (current) parts.push(current);
  return parts.map((part, i) => `${header}${parts.length > 1 ? `\n📄 <b>Частина ${i + 1} з ${parts.length}</b>` : ""}\n\n${part}`);
}

// Credentials are passed only by the Node route, never read by client modules.
// No background worker, polling, database, automatic retry or process-local dedupe.
export async function deliverToTelegram(data: Submission, config: TelegramConfig, fetcher: typeof fetch = fetch) {
  const messages = telegramMessages(data);
  const deadline = AbortSignal.timeout(22000);
  // The first recipient is required. Further recipients can be configured
  // before /start: Telegram's explicit "chat not found"/forbidden response
  // skips that unopened/blocked chat only. Network/other errors still fail.
  // Every submission attempts them afresh, so /start needs no webhook/state.
  const results = await Promise.allSettled([...new Set(config.chatIds)].map(async (chatId, index) => {
    let sent = 0;
    for (const text of messages) {
      if (sent) await new Promise(resolve => setTimeout(resolve, 1050));
      let response: Response;
      let body: { ok?: boolean; error_code?: number; description?: string; result?: { message_id?: number; chat?: { id?: number } }; parameters?: { retry_after?: number } };
      try {
        response = await fetcher(`https://api.telegram.org/bot${config.token}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", link_preview_options: { is_disabled: true } }),
          cache: "no-store", redirect: "error",
          signal: AbortSignal.any([deadline, AbortSignal.timeout(8000)]),
        });
        body = await response.json();
      } catch {
        // A lost response may follow a delivered message. Do not silently retry.
        throw new TelegramDeliveryError(sent, true);
      }
      if (index > 0 && sent === 0 && !response.ok && body?.ok === false
        && ((response.status === 403 && body.error_code === 403)
          || (response.status === 400 && body.error_code === 400 && body.description === "Bad Request: chat not found"))) {
        // No guest content, chat ID or credentials in logs or browser responses.
        console.warn("TELEGRAM_ADDITIONAL_RECIPIENT_UNAVAILABLE", { recipientIndex: index });
        return 0;
      }
      if (!response.ok || body?.ok !== true || !Number.isInteger(body.result?.message_id)
        || body.result!.message_id! <= 0 || String(body.result?.chat?.id) !== chatId) {
        const delay = body?.parameters?.retry_after;
        throw new TelegramDeliveryError(sent, response.ok && body?.ok === true,
          Number.isInteger(delay) && delay! > 0 ? Math.min(delay!, 3600) : undefined);
      }
      sent++;
    }
    return sent;
  }));
  let sent = 0, uncertain = false, retryAfter: number | undefined;
  let failed = results.length === 0;
  for (const result of results) {
    if (result.status === "fulfilled") { sent += result.value; continue; }
    failed = true;
    const error = result.reason instanceof TelegramDeliveryError ? result.reason : null;
    sent += error?.sentParts ?? 0;
    uncertain ||= error?.uncertain ?? true;
    if (error?.retryAfter) retryAfter = Math.max(retryAfter ?? 0, error.retryAfter);
  }
  if (failed) throw new TelegramDeliveryError(sent, uncertain, retryAfter);
  return { delivered: true as const, id: data.request_id };
}
