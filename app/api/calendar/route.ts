export function GET() {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Two Little Stories//Birthday//UK",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Kyiv",
    "BEGIN:STANDARD",
    "DTSTART:20261025T040000",
    "TZOFFSETFROM:+0300",
    "TZOFFSETTO:+0200",
    "TZNAME:EET",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    "UID:vladyslav-liliia-20261115@invitation.local",
    `DTSTAMP:${new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "")}`,
    "DTSTART;TZID=Europe/Kyiv:20261115T160000",
    "SUMMARY:День народження Владислава та Лілії",
    "LOCATION:Ресторан FRANCO\\, смт. Козин\\, Обухівське шосе\\, 43В",
    "DESCRIPTION:Нам виповнюється 2 рочки! Початок о 16:00.",
    "URL:https://franco.net.ua/",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  // Fold by UTF-8 byte count without splitting a Unicode character (RFC 5545).
  const fold = (line: string) => {
    const parts: string[] = [];
    let part = "";
    for (const char of line) {
      if (Buffer.byteLength(part + char, "utf8") > 74) {
        parts.push(part);
        part = " ";
      }
      part += char;
    }
    parts.push(part);
    return parts.join("\r\n");
  };
  return new Response(lines.map(fold).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="birthday-2026.ics"',
      "Cache-Control": "no-store",
    },
  });
}
