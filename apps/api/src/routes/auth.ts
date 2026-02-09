import { Router } from "express";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb } from "../db";
import { parseBody } from "../validation";
import { clearAuthCookie, requireAuth, setAuthCookie, signToken } from "../auth";
import type { AuthedRequest } from "../auth";
import { sendError } from "../errors";
import { wrap } from "../http";

const router = Router();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

router.post(
  "/register",
  wrap((req, res) => {
    const body = parseBody(registerSchema, req.body, res);
    if (!body) return;

    const db = getDb();
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(body.email);
    if (existing) {
      sendError(res, 409, { code: "CONFLICT", message: "Email already registered" });
      return;
    }

  const userId = randomUUID();
    const now = new Date().toISOString();
    const passwordHash = bcrypt.hashSync(body.password, 10);

    db.prepare(
      "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(userId, body.email, body.name, passwordHash, now);

    const token = signToken(userId);
    setAuthCookie(res, token);

    res.status(201).json({
      user: { id: userId, email: body.email, name: body.name },
    });
  })
);

router.post(
  "/login",
  wrap((req, res) => {
    const body = parseBody(loginSchema, req.body, res);
    if (!body) return;

    const db = getDb();
    const user = db
      .prepare("SELECT id, email, name, password_hash FROM users WHERE email = ?")
      .get(body.email) as
      | { id: string; email: string; name: string; password_hash: string }
      | undefined;

    if (!user || !bcrypt.compareSync(body.password, user.password_hash)) {
      sendError(res, 401, { code: "UNAUTHORIZED", message: "Invalid credentials" });
      return;
    }

    const token = signToken(user.id);
    setAuthCookie(res, token);

    res.json({ user: { id: user.id, email: user.email, name: user.name } });
  })
);

router.post(
  "/logout",
  wrap((_req, res) => {
    clearAuthCookie(res);
    res.json({ ok: true });
  })
);

router.get(
  "/me",
  requireAuth,
  wrap((req, res) => {
    const user = (req as AuthedRequest).user;
    res.json({ user });
  })
);

export default router;
