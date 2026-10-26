import "server-only";
import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { localAuth } from "./local-store";
export const COOKIE = "birthday_admin";
export const MAX_AGE = 8 * 60 * 60;
function secret() {
  const value = process.env.ADMIN_SESSION_SECRET || localAuth().sessionSecret;
  if (!value || value.length < 32 || value.startsWith("replace-"))
    throw new Error("AUTH_UNCONFIGURED");
  return value;
}
export function verifyPassword(password: string) {
  try {
    const [algorithm, salt, hash] = (
      process.env.ADMIN_PASSWORD_HASH || localAuth().hash
    ).split(":");
    if (
      algorithm !== "scrypt" ||
      !/^[a-f0-9]{32}$/.test(salt) ||
      !/^[a-f0-9]{128}$/.test(hash)
    )
      return false;
    return timingSafeEqual(
      scryptSync(password, salt, 64),
      Buffer.from(hash, "hex"),
    );
  } catch {
    return false;
  }
}
export function createSession() {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + MAX_AGE }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export function validSession(token?: string) {
  try {
    if (!token || token.length > 300) return false;
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const [payload, signature] = parts;
    const actual = Buffer.from(signature, "base64url");
    const expected = createHmac("sha256", secret()).update(payload).digest();
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return (
      Number.isFinite(data.exp) &&
      data.exp > Date.now() / 1000 &&
      data.exp <= Date.now() / 1000 + MAX_AGE + 1
    );
  } catch {
    return false;
  }
}
export async function isAdmin() {
  return validSession((await cookies()).get(COOKIE)?.value);
}
