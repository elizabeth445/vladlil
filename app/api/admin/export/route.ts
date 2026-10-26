import { isAdmin } from "@/lib/auth";
import { letters, rsvps } from "@/lib/local-store";
import { csv } from "@/lib/csv";
import { CHILDREN, answerKeys } from "@/lib/event";
import { submissionsEnabled } from "@/lib/features";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!submissionsEnabled) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!(await isAdmin()))
    return new Response("Unauthorized", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  const params = new URL(request.url).searchParams;
  const rsvp = params.get("kind") === "rsvp";
  try {
    const rows: unknown[][] = rsvp
      ? [
          ["Ім’я", "Присутність", "Гостей", "Коментар", "Дата"],
          ...rsvps().map((row) => [
            row.guest_name,
            row.attending ? "Так" : "Ні",
            row.guests,
            row.comment,
            row.created_at,
          ]),
        ]
      : [
          ["Дитина", "Гість", "Запитання", "Відповідь", "Дата"],
          ...letters(params.get("child") || undefined).flatMap((row) =>
            answerKeys.map((key, i) => [
              CHILDREN[row.child].name,
              row.guest_name,
              CHILDREN[row.child].questions[i],
              row.answers[key],
              row.created_at,
            ]),
          ),
        ];
    return new Response(csv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${rsvp ? "rsvp" : "letters"}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { error: "Не вдалося експортувати відповіді." },
      { status: 503 },
    );
  }
}
