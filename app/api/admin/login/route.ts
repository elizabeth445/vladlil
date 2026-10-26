import { cookies } from "next/headers";
import { COOKIE, createSession, MAX_AGE, verifyPassword } from "@/lib/auth";
import { checkRate } from "@/lib/local-store";
import { noStore, rateKey, readJson, sameOrigin } from "@/lib/http";
import { submissionsEnabled } from "@/lib/features";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!submissionsEnabled) return new Response(null, { status: 404, headers: noStore });
  if (!sameOrigin(request))
    return Response.json({ error: "Запит не дозволено." }, { status: 403 });
  let password: unknown;
  try {
    ({ password } = await readJson(request));
  } catch {
    return Response.json({ error: "Перевірте введені дані." }, { status: 400 });
  }
  if (typeof password !== "string" || password.length > 256)
    return Response.json({ error: "Перевірте пароль." }, { status: 400 });
  try {
    if (!checkRate(rateKey(request, "login"), 5))
      return Response.json(
        { error: "Забагато спроб. Спробуйте за годину." },
        { status: 429, headers: noStore },
      );
    if (!verifyPassword(password))
      return Response.json(
        { error: "Неправильний пароль." },
        { status: 401, headers: noStore },
      );
    (await cookies()).set(COOKIE, createSession(), {
      httpOnly: true,
      secure:
        process.env.NODE_ENV === "production" &&
        new URL(request.url).protocol === "https:",
      sameSite: "strict",
      maxAge: MAX_AGE,
      path: "/",
    });
    return Response.json({ ok: true }, { headers: noStore });
  } catch {
    return Response.json(
      { error: "Не вдалося увійти. Спробуйте ще раз." },
      { status: 503, headers: noStore },
    );
  }
}
