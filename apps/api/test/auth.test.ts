import { beforeAll, describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import request from "supertest";
import type { Express } from "express";

let app: Express;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  const tmpDir = path.resolve(__dirname, "../.tmp");
  fs.mkdirSync(tmpDir, { recursive: true });
  process.env.DB_PATH = path.join(
    tmpDir,
    `auth-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`
  );
  const mod = await import("../src/index");
  app = mod.default;
});

describe("auth flow", () => {
  it("registers and returns current user", async () => {
    const email = `user_${Date.now()}@example.com`;
    const agent = request.agent(app);

    const register = await agent
      .post("/auth/register")
      .send({ name: "Test User", email, password: "password123" })
      .expect(201);

    expect(register.body.user.email).toBe(email);

    const me = await agent.get("/auth/me").expect(200);
    expect(me.body.user.email).toBe(email);
  });
});
