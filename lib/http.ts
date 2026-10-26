import "server-only";
import { createHmac } from "node:crypto";
import { localAuth } from "./local-store";
export function sameOrigin(request: Request) {
  const url = new URL(request.url);
  const expected =
    process.env.APP_ORIGIN ||
    `${url.protocol}//${request.headers.get("host") || url.host}`;
  return request.headers.get("origin") === expected;
}
export async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new Error("INVALID_BODY");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_BODY");
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 32768) {
      await reader.cancel();
      throw new Error("INVALID_BODY");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export function rateKey(request: Request, scope: string) {
  const secret = localAuth().rateSecret;
  if (!secret || secret.length < 32 || secret.startsWith("replace-"))
    throw new Error("RATE_LIMIT_UNCONFIGURED");
  const ip = process.env.VERCEL
    ? request.headers.get("x-vercel-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown"
    : process.env.TRUST_PROXY === "1"
      ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown"
      : "local";
  return createHmac("sha256", secret).update(`${scope}:${ip}`).digest("hex");
}
export const noStore = { "Cache-Control": "no-store" };
