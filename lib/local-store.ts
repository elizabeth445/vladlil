import "server-only";
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
export const dataDirectory = path.join(process.cwd(), ".data");
let store: DatabaseSync | undefined;
export function database() {
  if (store) return store;
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
  store = new DatabaseSync(path.join(dataDirectory, "invitation.sqlite"));
  store.exec(`PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS guest_letters (id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, child TEXT NOT NULL CHECK(child IN ('vladyslav','liliia')), guest_name TEXT NOT NULL, answers TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rsvp_responses (id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, guest_name TEXT NOT NULL, attending INTEGER NOT NULL, guests INTEGER NOT NULL, comment TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL);
  `);
  return store;
}
export type Letter = {
  id: string;
  child: "vladyslav" | "liliia";
  guest_name: string;
  answers: Record<string, string>;
  created_at: string;
};
export type RSVPResponse = {
  id: string;
  guest_name: string;
  attending: number;
  guests: number;
  comment: string;
  created_at: string;
};
export function checkRate(key: string, limit: number) {
  const db = database(),
    now = Date.now();
  const row = db
    .prepare(
      `INSERT INTO rate_limits(key,attempts,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<=? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<=? THEN ? ELSE reset_at END RETURNING attempts`,
    )
    .get(key, now + 3600000, now, now, now + 3600000) as { attempts: number };
  db.prepare("DELETE FROM rate_limits WHERE reset_at < ?").run(now - 86400000);
  return row.attempts <= limit;
}
export function saveSubmission(
  kind: "letter" | "rsvp",
  payload: Record<string, unknown>,
  key: string,
) {
  const db = database(),
    table = kind === "letter" ? "guest_letters" : "rsvp_responses";
  db.exec("BEGIN IMMEDIATE");
  try {
    const existing = db
      .prepare(`SELECT id FROM ${table} WHERE request_id=?`)
      .get(String(payload.request_id)) as { id: string } | undefined;
    if (existing) {
      db.exec("COMMIT");
      return existing.id;
    }
    if (!checkRate(key, 12)) throw new Error("RATE_LIMIT");
    const id = randomUUID(),
      created = new Date().toISOString();
    if (kind === "letter") {
      const answers = payload.answers as Record<string, string>;
      db.prepare("INSERT INTO guest_letters VALUES (?,?,?,?,?,?)").run(
        id,
        String(payload.request_id),
        String(payload.child),
        answers.identity,
        JSON.stringify(answers),
        created,
      );
    } else
      db.prepare("INSERT INTO rsvp_responses VALUES (?,?,?,?,?,?,?)").run(
        id,
        String(payload.request_id),
        String(payload.guest_name),
        payload.attending ? 1 : 0,
        payload.attending ? Number(payload.guests) : 0,
        String(payload.comment),
        created,
      );
    db.exec("COMMIT");
    return id;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function letters(child?: string) {
  const rows =
    child === "vladyslav" || child === "liliia"
      ? database()
          .prepare(
            "SELECT * FROM guest_letters WHERE child=? ORDER BY created_at DESC",
          )
          .all(child)
      : database()
          .prepare("SELECT * FROM guest_letters ORDER BY created_at DESC")
          .all();
  return rows.map((row) => ({
    ...row,
    answers: JSON.parse(String(row.answers)),
  })) as Letter[];
}
export function rsvps() {
  return database()
    .prepare("SELECT * FROM rsvp_responses ORDER BY created_at DESC")
    .all() as RSVPResponse[];
}
type LocalAuth = { hash: string; sessionSecret: string; rateSecret: string };
let auth: LocalAuth | undefined;
export function localAuth(): LocalAuth {
  if (auth) return auth;
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
  const file = path.join(dataDirectory, "auth.json");
  if (!existsSync(file)) {
    const password = randomBytes(18).toString("base64url"),
      salt = randomBytes(16).toString("hex");
    const value = {
      hash: `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`,
      sessionSecret: randomBytes(32).toString("hex"),
      rateSecret: randomBytes(32).toString("hex"),
    };
    try {
      writeFileSync(file, JSON.stringify(value), { mode: 0o600, flag: "wx" });
      writeFileSync(
        path.join(dataDirectory, "admin-access.txt"),
        `Локальная панель: http://127.0.0.1:3000/admin\nПароль: ${password}\nХраните этот файл в секрете.\n`,
        { mode: 0o600, flag: "wx" },
      );
    } catch (error) {
      if (!existsSync(file)) throw error;
    }
  }
  auth = JSON.parse(readFileSync(file, "utf8")) as LocalAuth;
  return auth;
}
