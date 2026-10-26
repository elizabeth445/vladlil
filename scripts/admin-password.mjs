import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
const mutedOutput = new Writable({
  write(_chunk, _encoding, next) {
    next();
  },
});
const rl = createInterface({
  input: process.stdin,
  output: mutedOutput,
  terminal: true,
});
process.stdout.write(
  "Введите новый пароль администратора (не менее 14 символов, ввод скрыт): ",
);
const password = await rl.question("");
rl.close();
process.stdout.write("\n");
if (password.length < 14) {
  process.stderr.write("Нужен пароль не короче 14 символов.\n");
  process.exit(1);
}
const salt = randomBytes(16).toString("hex");
process.stdout.write(
  `ADMIN_PASSWORD_HASH=scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}\n`,
);
