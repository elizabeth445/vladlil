export const EVENT = {
  title: "День народження Владислава та Лілії",
  date: "15 листопада 2026",
  start: "2026-11-15T16:00:00+02:00",
  timezone: "Europe/Kyiv",
  venue: "Ресторан FRANCO",
  address: "смт. Козин, Обухівське шосе, 43В",
  website: "https://franco.net.ua/",
  directions:
    "https://www.google.com/maps/dir/?api=1&destination=Ресторан+FRANCO,+Козин,+Обухівське+шосе,+43В",
} as const;
export type Child = "vladyslav" | "liliia";
export const CHILDREN = {
  vladyslav: {
    name: "Владислав",
    recipient: "Владислава",
    color: "blue",
    art: "lion",
    intro:
      "Сьогодні я – Владислав святкую свій день народження – мені 2 роки і буду радий, якщо ви відповісте на декілька запитань:",
    questions: [
      "Як вас звати і ким ви мені доводитесь?",
      "На кого з батьків я схожий?",
      "Опишіть мій характер зараз:",
      "Ким я стану коли виросту?",
      "Побажання на майбутнє:",
    ],
    closing:
      "Цей лист мама збереже і коли мені виповниться 18 років ми прочитаємо його разом з Вами!",
  },
  liliia: {
    name: "Лілія",
    recipient: "Лілії",
    color: "pink",
    art: "kitten",
    intro:
      "Сьогодні я – Лілія святкую свій день народження (мені 2 роки) і буду рада, якщо Ви відповісте на декілька запитань:",
    questions: [
      "Як Вас звати? Ким Ви приходитесь мені?",
      "На кого я більше схожа?",
      "Опишіть мій характер зараз:",
      "Якою Ви бачите мене в майбутньому? Яка в мене професія?",
      "Що Ви мені побажаєте?",
    ],
    closing:
      "Цей лист мама збереже та покладе до коробки спогадів, а коли мені виповниться 18, то ми прочитаємо його разом з Вами!",
  },
} as const;
export const answerKeys = [
  "identity",
  "resemblance",
  "character",
  "future",
  "wishes",
] as const;
export function countdown(now: number) {
  const seconds = Math.max(
    0,
    Math.floor((Date.parse(EVENT.start) - now) / 1000),
  );
  return {
    finished: now >= Date.parse(EVENT.start),
    values: [
      Math.floor(seconds / 86400),
      Math.floor(seconds / 3600) % 24,
      Math.floor(seconds / 60) % 60,
      seconds % 60,
    ],
  };
}
export function calendarDays() {
  const offset = (new Date(Date.UTC(2026, 10, 1)).getUTCDay() + 6) % 7;
  return [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: 30 }, (_, i) => i + 1),
  ];
}
