// One HTTPS request, not a bot server or a polling loop. Never pass tokens as CLI args.
const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token || !/^\d+:[A-Za-z0-9_-]{30,}$/.test(token)) {
  console.error('Добавьте TELEGRAM_BOT_TOKEN в .env.local и запустите npm run telegram:chat-id.');
  process.exitCode = 1;
} else {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      // No offset: don't acknowledge/delete pending updates. No long polling.
      body: JSON.stringify({ timeout: 0, limit: 100 }),
      signal: AbortSignal.timeout(10000), redirect: 'error',
    });
    const body = await response.json();
    if (!response.ok || body.ok !== true || !Array.isArray(body.result)) {
      console.error(response.status === 409
        ? 'У бота уже настроен webhook или запущен другой получатель обновлений. Утилита не меняет настройки бота.'
        : 'Telegram не вернул обновления. Проверьте токен в .env.local.');
      process.exitCode = 1;
    } else {
      const chats = new Map();
      for (const update of body.result) {
        const message = update.message;
        if (message?.chat?.type === 'private' && /^\/start(?:\s|$)/.test(message.text || '')) {
          chats.set(String(message.chat.id), { chatId: String(message.chat.id), name: message.chat.first_name || 'Личный чат' });
        }
      }
      if (chats.size) {
        for (const chat of chats.values()) console.log(JSON.stringify(chat));
        console.log('Добавьте нужные числовые chatId в TELEGRAM_CHAT_ID в .env.local и Vercel Production. Для нескольких получателей разделите ID запятыми; каждый должен отправить боту /start.');
      } else {
        console.log('Откройте своего бота, отправьте /start и повторите команду один раз. Telegram хранит обновления ограниченное время.');
        process.exitCode = 1;
      }
    }
  } catch {
    console.error('Не удалось связаться с Telegram. Проверьте подключение и повторите команду.');
    process.exitCode = 1;
  }
}
