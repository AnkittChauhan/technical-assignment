import type { Response } from "express";
import type { ZodSchema } from "zod";
import { sendError } from "./errors";

export function parseBody<T>(schema: ZodSchema<T>, body: unknown, res: Response) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    sendError(res, 400, {
      code: "BAD_REQUEST",
      message: "Invalid payload",
      details: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        issue: issue.message,
      })),
    });
    return null;
  }
  return parsed.data;
}
