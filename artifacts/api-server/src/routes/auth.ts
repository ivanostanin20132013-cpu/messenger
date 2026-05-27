import { Router } from "express";
import crypto from "crypto";

export const users = new Map<string, { passwordHash: string }>();
export const tokens = new Map<string, string>();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

const router = Router();

router.post("/auth/register", (req, res) => {
  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password) {
    res.status(400).json({ ok: false, msg: "Имя и пароль обязательны" });
    return;
  }
  if (users.has(username)) {
    res.status(400).json({ ok: false, msg: "Пользователь уже существует" });
    return;
  }
  users.set(username, { passwordHash: hashPassword(password) });
  const token = generateToken();
  tokens.set(token, username);
  res.json({ ok: true, token, username });
});

router.post("/auth/login", (req, res) => {
  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password) {
    res.status(400).json({ ok: false, msg: "Имя и пароль обязательны" });
    return;
  }
  const user = users.get(username);
  if (!user || user.passwordHash !== hashPassword(password)) {
    res.status(401).json({ ok: false, msg: "Неверное имя или пароль" });
    return;
  }
  const token = generateToken();
  tokens.set(token, username);
  res.json({ ok: true, token, username });
});

export default router;
