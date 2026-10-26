import { cookies } from "next/headers";
import { COOKIE } from "@/lib/auth";
import { sameOrigin } from "@/lib/http";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  (await cookies()).delete(COOKIE);
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
