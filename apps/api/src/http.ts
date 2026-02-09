import type { Request, Response } from "express";
import { sendError } from "./errors";

export type Handler = (req: Request, res: Response) => void;

export function wrap(handler: Handler) {
  return (req: Request, res: Response) => {
    try {
      handler(req, res);
    } catch (error) {
      console.error("[api] unhandled error", error);
      sendError(res, 500, { code: "INTERNAL", message: "Unexpected server error" });
    }
  };
}
