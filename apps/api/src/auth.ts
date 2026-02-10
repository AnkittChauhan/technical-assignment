import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { sendError } from "./errors";
import { getDb } from "./db";

type JwtPayload = {
  sub: string;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type AuthedRequest = Request & { user: AuthUser };

const isDevelopment =
  !process.env.NODE_ENV ||
  process.env.NODE_ENV === "development" ||
  process.env.NODE_ENV === "test";

const jwtSecret = (() => {
  if (isDevelopment) {
    return process.env.JWT_SECRET ?? "dev-secret";
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required in non-development environments");
  }

  return process.env.JWT_SECRET;
})();

export function signToken(userId: string) {
  return jwt.sign({ sub: userId } satisfies JwtPayload, jwtSecret, { expiresIn: "7d" });
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

function getToken(req: Request) {
  const header = req.header("authorization");
  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length);
  }
  const cookie = req.cookies?.token;
  if (typeof cookie === "string") {
    return cookie;
  }
  return null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = getToken(req);
  if (!token) {
    sendError(res, 401, { code: "UNAUTHORIZED", message: "Missing auth token" });
    return;
  }

  try {
    const payload = jwt.verify(token, jwtSecret) as JwtPayload;
    const row = getDb()
      .prepare("SELECT id, email, name FROM users WHERE id = ?")
      .get(payload.sub) as AuthUser | undefined;

    if (!row) {
      sendError(res, 401, { code: "UNAUTHORIZED", message: "User not found" });
      return;
    }

    (req as AuthedRequest).user = row;
    next();
  } catch {
    sendError(res, 401, { code: "UNAUTHORIZED", message: "Invalid auth token" });
  }
}
