import "server-only";
import { letterSchema, rsvpSchema } from "./validation";
import { saveSubmission } from "./local-store";
import { noStore, rateKey, readJson, sameOrigin } from "./http";
import { submissionsEnabled } from "./features";
export async function submit(request: Request, kind: "letter" | "rsvp") {
  if (!submissionsEnabled)
    return Response.json(
      { saved: false, error: "Надсилання відповідей поки вимкнено. Збережіть чернетку на своєму пристрої." },
      { status: 503, headers: noStore },
    );
  if (!sameOrigin(request))
    return Response.json(
      { error: "Запит не дозволено." },
      { status: 403, headers: noStore },
    );
  let body: unknown;
  try {
    body = await readJson(request);
  } catch {
    return Response.json(
      { error: "Перевірте формат і розмір відповіді." },
      { status: 400, headers: noStore },
    );
  }
  const result = (kind === "letter" ? letterSchema : rsvpSchema).safeParse(
    body,
  );
  if (!result.success)
    return Response.json(
      {
        error:
          "Будь ласка, заповніть усі поля. Відповіді мають містити від 2 до 1500 символів.",
      },
      { status: 400, headers: noStore },
    );
  try {
    const {
      website: _website,
      started_at: _startedAt,
      ...payload
    } = result.data;
    void _website;
    void _startedAt;
    const id = saveSubmission(kind, payload, rateKey(request, "submission"));
    return Response.json(
      { saved: true, id },
      { status: 201, headers: noStore },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT")
      return Response.json(
        { error: "Забагато спроб. Спробуйте, будь ласка, за годину." },
        { status: 429, headers: { ...noStore, "Retry-After": "3600" } },
      );
    return Response.json(
      {
        error:
          "Зараз не вдалося зберегти відповідь. Ваш текст залишився у формі. Спробуйте ще раз.",
      },
      { status: 503, headers: noStore },
    );
  }
}
