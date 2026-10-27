import { z } from "zod";
import { noStore, readJson, sameOrigin } from "@/lib/http";
import { submissionSchema } from "@/lib/validation";
import { deliverToTelegram, TelegramDeliveryError } from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 30;
const configuration = z.object({
  token: z.string().regex(/^\d+:[A-Za-z0-9_-]{30,}$/),
  chatIds: z.string().max(300)
    .transform(value => value.split(",").map(id => id.trim()))
    .pipe(z.array(z.string().regex(/^-?[1-9]\d*$/)).min(1).max(10)),
});

export async function POST(request: Request) {
  if (!sameOrigin(request) || request.headers.get("sec-fetch-site") === "cross-site")
    return Response.json({ delivered: false, error: "Запит не дозволено." }, { status: 403, headers: noStore });
  let body: unknown;
  try { body = await readJson(request); }
  catch {
    return Response.json({ delivered: false, error: "Перевірте формат і розмір відповіді." }, { status: 400, headers: noStore });
  }
  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ delivered: false, error: "Перевірте заповнення полів. Ім’я має містити 2–200 символів, відповіді — 2–1500. Якщо сторінку щойно відкрито, зачекайте кілька секунд." }, { status: 400, headers: noStore });
  // These two variables are read exclusively in this server-only route.
  const config = configuration.safeParse({ token: process.env.TELEGRAM_BOT_TOKEN, chatIds: process.env.TELEGRAM_CHAT_ID });
  if (!config.success)
    return Response.json({ delivered: false, error: "Надсилання тимчасово недоступне. Ваші відповіді залишилися у формі." }, { status: 503, headers: noStore });
  try {
    return Response.json(await deliverToTelegram(parsed.data, config.data), { status: 201, headers: noStore });
  } catch (error) {
    const delivery = error instanceof TelegramDeliveryError ? error : null;
    const message = delivery?.sentParts ? "Доставку підтверджено не для всіх повідомлень або отримувачів. Частину вже надіслано. Зв’яжіться з батьками перед повторною спробою, щоб уникнути дублювання."
      : delivery?.uncertain ? "Не отримали підтвердження доставки. Перевірте з організаторами перед повторною спробою — повідомлення могло надійти. Ваш текст збережено у формі."
      : "Не вдалося надіслати відповідь. Ваш текст залишився у формі. Спробуйте пізніше.";
    return Response.json({ delivered: false, error: message }, {
      status: delivery?.retryAfter ? 429 : 502,
      headers: { ...noStore, ...(delivery?.retryAfter ? { "Retry-After": String(delivery.retryAfter) } : {}) },
    });
  }
}
