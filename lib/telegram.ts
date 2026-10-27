import { answerKeys, CHILDREN } from "./event";
import type { Submission } from "./validation";

export type TelegramConfig = { token: string; chatId: string };
export class TelegramDeliveryError extends Error {
  constructor(readonly sentParts: number, readonly uncertain: boolean, readonly retryAfter?: number) {
    super("TELEGRAM_DELIVERY_FAILED");
  }
}

// Plain text: guest input cannot become Telegram HTML/Markdown or markup links.
export function telegramMessages(data: Submission, now = new Date()): string[] {
  const title = data.type === "rsvp" ? "🎂 RSVP — підтвердження присутності"
    : `${data.type === "vladyslav" ? "🦁" : "🐱"} Анкета гостя для ${CHILDREN[data.type].recipient}`;
  const name = (data.type === "rsvp" ? data.guest_name : data.answers.identity).replace(/\s+/g, " ");
  const time = new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv", dateStyle: "long", timeStyle: "medium",
  }).format(now);
  const header = `${title}\n\n👤 Гість: ${name}\n🕒 Надіслано: ${time} (Київ)`;
  const blocks = data.type === "rsvp" ? [
    `👤 Ім’я та прізвище\n${data.guest_name}`,
    `📅 Чи будете ви на святі?\n${data.attending ? "Так, із радістю!" : "На жаль, не зможу"}`,
    `👥 Кількість гостей разом із вами\n${data.attending ? data.guests : 0}`,
    `💬 Коментар\n${data.comment || "Не вказано"}`,
  ] : answerKeys.map((key, index) => `${["👋", "👨‍👩‍👧‍👦", "✨", "🌟", "💌"][index]} ${CHILDREN[data.type as "vladyslav" | "liliia"].questions[index]}\n${data.answers[key]}`);
  // A whole answer (max 1500 UTF-16 units) fits in one part. Pack complete
  // questions in order, leaving room for the repeated header and part count.
  const budget = 4000 - header.length - 40;
  const parts: string[] = [];
  let current = "";
  for (const block of blocks) {
    if (current && current.length + block.length + 2 > budget) {
      parts.push(current);
      current = "";
    }
    current += `${current ? "\n\n" : ""}${block}`;
  }
  if (current) parts.push(current);
  return parts.map((part, i) => `${header}${parts.length > 1 ? `\n📄 Частина ${i + 1} з ${parts.length}` : ""}\n\n${part}`);
}

// Credentials are passed only by the Node route, never read by client modules.
// No background worker, polling, database, automatic retry or process-local dedupe.
export async function deliverToTelegram(data: Submission, config: TelegramConfig, fetcher: typeof fetch = fetch) {
  const messages = telegramMessages(data);
  const deadline = AbortSignal.timeout(22000);
  let sent = 0;
  for (const text of messages) {
    if (sent) await new Promise(resolve => setTimeout(resolve, 1050));
    let response: Response;
    let body: { ok?: boolean; result?: { message_id?: number; chat?: { id?: number } }; parameters?: { retry_after?: number } };
    try {
      response = await fetcher(`https://api.telegram.org/bot${config.token}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: config.chatId, text, link_preview_options: { is_disabled: true } }),
        cache: "no-store", redirect: "error",
        signal: AbortSignal.any([deadline, AbortSignal.timeout(8000)]),
      });
      body = await response.json();
    } catch {
      // A lost response may follow a delivered message. Do not silently retry.
      throw new TelegramDeliveryError(sent, true);
    }
    if (!response.ok || body?.ok !== true || !Number.isInteger(body.result?.message_id)
      || body.result!.message_id! <= 0 || String(body.result?.chat?.id) !== config.chatId) {
      const delay = body?.parameters?.retry_after;
      throw new TelegramDeliveryError(sent, response.ok && body?.ok === true,
        Number.isInteger(delay) && delay! > 0 ? Math.min(delay!, 3600) : undefined);
    }
    sent++;
  }
  return { delivered: true as const, id: data.request_id };
}
