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
    `health-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`
  );
  const mod = await import("../src/index");
  app = mod.default;
});

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await request(app).get("/health").expect(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.ts).toBe("string");
  });
});
