import { test, expect } from "@playwright/test";
import { POST } from "../app/api/submit/route";
import { deliverToTelegram, telegramMessages, TelegramDeliveryError } from "../lib/telegram";
import { submissionSchema, type Submission } from "../lib/validation";
import { answerKeys, CHILDREN } from "../lib/event";

const fakeToken = `123456:${"x".repeat(35)}`;
const config = { token: fakeToken, chatIds: ["123456789"] };
const answers = { identity: "ТЕСТ — Марія, тітка", resemblance: "На маму", character: "Лагідний характер", future: "Щасливе майбутнє", wishes: "Міцного здоров’я!" };
const payload = (type: "rsvp" | "vladyslav" | "liliia"): Submission => ({
  request_id: crypto.randomUUID(), started_at: Date.now() - 3000, website: "",
  ...(type === "rsvp" ? { type, guest_name: "Марія", attending: true, guests: 3, comment: "Без горіхів" } : { type, answers }),
});
const confirmed = (chatId = config.chatIds[0]) => Response.json({ ok: true, result: { message_id: 42, chat: { id: Number(chatId) } } });
const plainText = (html: string) => html.replace(/<\/?b>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const request = (data: unknown, origin = "https://invitation.test") => new Request("https://invitation.test/api/submit", {
  method: "POST", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify(data),
});

test("Telegram labels are bold, answers are safely escaped, ordered parts retain Kyiv timestamps", () => {
  for (const type of ["rsvp", "vladyslav", "liliia"] as const) {
    const data = payload(type);
    const messages = telegramMessages(data, new Date("2026-11-15T14:00:00Z"));
    expect(messages[0]).toContain("16:00:00");
    expect(messages[0]).toContain("Київ");
    expect(messages[0]).not.toContain(data.request_id);
    expect(messages[0]).not.toContain("Номер відповіді");
    expect(messages[0]).toContain("👤");
    expect(messages[0]).toContain("<b>Гість:</b>");
    expect(messages[0]).toContain("<b>Надіслано:</b>");
    if (type === "rsvp") {
      expect(messages[0]).toContain("Без горіхів");
      expect(messages[0]).toContain("<b>Кількість гостей разом із вами</b>\n3");
    } else {
      for (const question of CHILDREN[type].questions) expect(messages.join("\n")).toContain(`<b>${question}</b>`);
      for (const answer of Object.values(answers)) expect(messages.join("\n")).toContain(answer);
      expect(messages.join("\n")).not.toContain(`<b>${answers.wishes}</b>`);
    }
  }
  const long = payload("liliia") as Extract<Submission, { type: "liliia" }>;
  long.answers = { identity: "<b>Марія & родина</b>", resemblance: "💗".repeat(750), character: "Я".repeat(1500), future: "М".repeat(1500), wishes: "&".repeat(1500) };
  expect(submissionSchema.safeParse(long).success).toBe(true);
  const messages = telegramMessages(long);
  expect(messages.length).toBeGreaterThan(1);
  for (const [i, message] of messages.entries()) {
    expect(plainText(message).length).toBeLessThanOrEqual(4000);
    expect(message).toContain(`Частина ${i + 1} з ${messages.length}`);
    expect(message).not.toContain(long.request_id);
  }
  expect(messages.join("\n")).toContain("&lt;b&gt;Марія &amp; родина&lt;/b&gt;");
  expect(messages.join("\n")).not.toContain("<b>Марія & родина</b>");
  const text = plainText(messages.join("\n"));
  const positions = CHILDREN.liliia.questions.map(question => text.indexOf(question));
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  for (const answer of Object.values(long.answers)) expect(text).toContain(answer);
});

test("transport confirms every part, never retries, rejects Telegram failures and partial delivery", async () => {
  const data = payload("vladyslav") as Extract<Submission, { type: "vladyslav" }>;
  data.answers = { ...answers, resemblance: "М".repeat(1500), character: "Х".repeat(1500), future: "П".repeat(1500), wishes: "З".repeat(1500) };
  const sent: Record<string, unknown>[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    expect(String(url)).toBe(`https://api.telegram.org/bot${fakeToken}/sendMessage`);
    sent.push(JSON.parse(String(init?.body)));
    expect(init?.cache).toBe("no-store");
    expect(init?.signal).toBeTruthy();
    return confirmed();
  };
  expect((await deliverToTelegram(data, config, fetcher)).delivered).toBe(true);
  expect(sent.length).toBe(telegramMessages(data).length);
  expect(sent.every(body => body.chat_id === config.chatIds[0] && body.parse_mode === "HTML")).toBe(true);
  for (const failure of [
    () => Response.json({ ok: false }, { status: 403 }),
    () => Response.json({ ok: false }),
    () => Response.json({ ok: true, result: { message_id: 42, chat: { id: 999 } } }),
    () => new Response("not-json"),
  ]) await expect(deliverToTelegram(payload("rsvp"), config, async () => failure())).rejects.toBeInstanceOf(TelegramDeliveryError);
  let count = 0;
  await expect(deliverToTelegram(data, config, async () => {
    count++; return count === 1 ? confirmed() : Response.json({ ok: false }, { status: 500 });
  })).rejects.toMatchObject({ sentParts: 1, uncertain: false });
  expect(count).toBe(2);
  await expect(deliverToTelegram(payload("rsvp"), config, async () => { throw new Error("network secret URL"); })).rejects.toMatchObject({ sentParts: 0, uncertain: true, message: "TELEGRAM_DELIVERY_FAILED" });
});

test("all three submissions fan out privately, deduplicate recipients and wait for every available chat", async () => {
  const other = "987654321";
  const multiple = { token: fakeToken, chatIds: [config.chatIds[0], other, config.chatIds[0]] };
  for (const type of ["rsvp", "vladyslav", "liliia"] as const) {
    const seen: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let completed = false;
    const delivery = deliverToTelegram(payload(type), multiple, async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      seen.push(body.chat_id);
      if (body.chat_id === other) await gate;
      return confirmed(body.chat_id);
    }).then(result => { completed = true; return result; });
    await expect.poll(() => seen.length).toBe(2);
    expect(seen).toEqual([config.chatIds[0], other]);
    expect(completed).toBe(false);
    release();
    expect((await delivery).delivered).toBe(true);
  }
  const long = payload("liliia") as Extract<Submission, { type: "liliia" }>;
  long.answers = { ...answers, resemblance: "А".repeat(1500), character: "Б".repeat(1500), future: "В".repeat(1500), wishes: "Г".repeat(1500) };
  const parts = new Map<string, string[]>();
  await deliverToTelegram(long, multiple, async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    parts.set(body.chat_id, [...(parts.get(body.chat_id) ?? []), body.text]);
    return confirmed(body.chat_id);
  });
  expect(parts.get(other)).toEqual(parts.get(config.chatIds[0]));
  expect(parts.get(other)).toHaveLength(telegramMessages(long).length);
});

test("a preconfigured secondary chat activates after start while real failures and partial delivery remain visible", async () => {
  const other = "987654321", multiple = { token: fakeToken, chatIds: [config.chatIds[0], other] };
  for (const [status, description] of [[400, "Bad Request: chat not found"], [403, "Forbidden: bot was blocked by the user"]] as const) {
    const result = await deliverToTelegram(payload("rsvp"), multiple, async (_url, init) => {
      const { chat_id } = JSON.parse(String(init?.body));
      return chat_id === other ? Response.json({ ok: false, error_code: status, description }, { status }) : confirmed(chat_id);
    });
    expect(result.delivered).toBe(true);
  }
  // No cached unavailable state: the very next submission reaches the new chat.
  const reached: string[] = [];
  await deliverToTelegram(payload("rsvp"), multiple, async (_url, init) => {
    const { chat_id } = JSON.parse(String(init?.body)); reached.push(chat_id); return confirmed(chat_id);
  });
  expect(reached).toEqual(multiple.chatIds);
  for (const failingChat of multiple.chatIds) {
    await expect(deliverToTelegram(payload("rsvp"), multiple, async (_url, init) => {
      const { chat_id } = JSON.parse(String(init?.body));
      return chat_id === failingChat ? Response.json({ ok: false, error_code: 500 }, { status: 500 }) : confirmed(chat_id);
    })).rejects.toMatchObject({ sentParts: 1, uncertain: false });
  }
  await expect(deliverToTelegram(payload("rsvp"), multiple, async (_url, init) => {
    const { chat_id } = JSON.parse(String(init?.body));
    return chat_id === config.chatIds[0] ? Response.json({ ok: false, error_code: 400, description: "Bad Request: chat not found" }, { status: 400 }) : confirmed(chat_id);
  })).rejects.toMatchObject({ sentParts: 1, uncertain: false });
  const long = payload("vladyslav") as Extract<Submission, { type: "vladyslav" }>;
  long.answers = { ...answers, resemblance: "А".repeat(1500), character: "Б".repeat(1500), future: "В".repeat(1500), wishes: "Г".repeat(1500) };
  const received = new Map<string, number>();
  await expect(deliverToTelegram(long, multiple, async (_url, init) => {
    const { chat_id } = JSON.parse(String(init?.body));
    const count = (received.get(chat_id) ?? 0) + 1; received.set(chat_id, count);
    return chat_id === other && count > 1 ? Response.json({ ok: false, error_code: 403 }, { status: 403 }) : confirmed(chat_id);
  })).rejects.toMatchObject({ sentParts: telegramMessages(long).length + 1, uncertain: false });
  expect(received.get(config.chatIds[0])).toBe(telegramMessages(long).length);
});

test("Node endpoint validates requests before sending and returns success only on Telegram confirmation", async () => {
  const originalFetch = globalThis.fetch;
  const original = { token: process.env.TELEGRAM_BOT_TOKEN, chat: process.env.TELEGRAM_CHAT_ID, origin: process.env.APP_ORIGIN };
  process.env.TELEGRAM_BOT_TOKEN = fakeToken;
  process.env.TELEGRAM_CHAT_ID = config.chatIds[0];
  delete process.env.APP_ORIGIN;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return confirmed(); };
  try {
    for (const type of ["rsvp", "vladyslav", "liliia"] as const) {
      const response = await POST(request(payload(type)));
      expect(response.status).toBe(201);
      expect((await response.json()).delivered).toBe(true);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect(calls).toBe(3);
    process.env.TELEGRAM_CHAT_ID = ` ${config.chatIds[0]}, 987654321, ${config.chatIds[0]} `;
    const destinations: string[] = [];
    globalThis.fetch = async (_url, init) => {
      const { chat_id } = JSON.parse(String(init?.body)); destinations.push(chat_id); return confirmed(chat_id);
    };
    expect((await POST(request(payload("liliia")))).status).toBe(201);
    expect(destinations).toEqual([config.chatIds[0], "987654321"]);
    for (const invalid of ["", "123,", "@username", "0", "123,nope", Array(11).fill("123").join(",")]) {
      process.env.TELEGRAM_CHAT_ID = invalid;
      expect((await POST(request(payload("rsvp")))).status).toBe(503);
    }
    expect(destinations).toHaveLength(2);
    process.env.TELEGRAM_CHAT_ID = config.chatIds[0];
    globalThis.fetch = async () => { calls++; return confirmed(); };
    const valid = payload("rsvp");
    for (const [data, origin, status] of [
      [{ ...valid, website: "spam" }, undefined, 400],
      [{ ...valid, started_at: Date.now() + 5000 }, undefined, 400],
      [{ ...valid, guest_name: "a".repeat(201) }, undefined, 400],
      [{ ...valid, guests: 0 }, undefined, 400],
      [{ ...valid, attending: "yes" }, undefined, 400],
      [{ ...valid, type: "unknown" }, undefined, 400],
      [{ ...payload("liliia"), answers: { ...answers, wishes: "" } }, undefined, 400],
      [{ ...payload("vladyslav"), answers: { ...answers, wishes: "a".repeat(1501) } }, undefined, 400],
      [{ ...valid, token: "injected" }, undefined, 400],
      [valid, "https://evil.test", 403],
      [{ ...valid, comment: "a".repeat(32769) }, undefined, 400],
    ] as const) expect((await POST(request(data, origin))).status).toBe(status);
    expect(calls).toBe(3);
    const malformed = new Request("https://invitation.test/api/submit", { method: "POST", headers: { origin: "https://invitation.test", "Content-Type": "application/json" }, body: "{" });
    expect((await POST(malformed)).status).toBe(400);
    delete process.env.TELEGRAM_BOT_TOKEN;
    expect((await POST(request(valid))).status).toBe(503);
    expect(calls).toBe(3);
    process.env.TELEGRAM_BOT_TOKEN = fakeToken;
    globalThis.fetch = async () => Response.json({ ok: false, parameters: { retry_after: 3 } }, { status: 429 });
    const limited = await POST(request(valid));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("3");
    expect((await limited.json()).delivered).toBe(false);
    globalThis.fetch = async () => { throw new Error(fakeToken); };
    const failed = await POST(request(valid));
    expect(failed.status).toBe(502);
    const error = await failed.text();
    expect(error).not.toContain(fakeToken);
    expect(error).toContain("Не отримали підтвердження");
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of [["TELEGRAM_BOT_TOKEN", original.token], ["TELEGRAM_CHAT_ID", original.chat], ["APP_ORIGIN", original.origin]]) {
      if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
    }
  }
});

test("all three browser forms retain failed answers, lock repeated clicks and wait for confirmed success", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Пропустити", exact: true }).click();
  const seen: string[] = [];
  let release!: () => void;
  let gate = new Promise<void>(resolve => { release = resolve; });
  let confirmedDelivery = false;
  await page.route("**/api/submit", async route => {
    seen.push(route.request().postDataJSON().type);
    await gate;
    await route.fulfill({ status: confirmedDelivery ? 201 : 502, json: confirmedDelivery
      ? { delivered: true } : { delivered: false, error: "Telegram тимчасово недоступний. Спробуйте пізніше." } });
  });
  for (const type of ["vladyslav", "liliia", "rsvp"] as const) {
    confirmedDelivery = false;
    gate = new Promise<void>(resolve => { release = resolve; });
    let form;
    if (type === "rsvp") {
      await page.locator("#rsvp-name").fill("Марія");
      await page.locator("#rsvp-comment").fill("Важлива відповідь");
      form = page.locator(".rsvp-form");
    } else {
      await page.locator(`#tab-${type}`).click();
      for (const key of answerKeys) await page.locator(`#${type}-${key}`).fill(answers[key]);
      form = page.locator(`#panel-${type} form`);
    }
    await expect(form.locator(".privacy-note")).toContainText("приватно");
    const count = seen.length;
    await form.getByRole("button").click();
    await expect(form.getByRole("button")).toBeDisabled();
    await form.dispatchEvent("submit");
    await expect.poll(() => seen.length).toBe(count + 1);
    await expect(page.locator(type === "rsvp" ? ".rsvp-success" : `#panel-${type} .letter-success`)).toHaveCount(0);
    release();
    await expect(form.locator("[role=alert]")).toContainText("недоступний");
    await expect(type === "rsvp" ? page.locator("#rsvp-comment") : page.locator(`#${type}-wishes`)).toHaveValue(type === "rsvp" ? "Важлива відповідь" : answers.wishes);
    confirmedDelivery = true;
    await form.getByRole("button").click();
    await expect(page.locator(type === "rsvp" ? ".rsvp-success" : `#panel-${type} .letter-success`)).toBeVisible();
    expect(seen.slice(-2)).toEqual([type, type]);
  }
});
