import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { sendError } from "./errors";
import { initDb } from "./db";
import authRouter from "./routes/auth";
import boardsRouter from "./routes/boards";
import columnsRouter from "./routes/columns";
import tasksRouter from "./routes/tasks";
import commentsRouter from "./routes/comments";
import { requireAuth } from "./auth";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

initDb();

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.use("/auth", authRouter);
app.use("/boards", requireAuth, boardsRouter);
app.use("/columns", requireAuth, columnsRouter);
app.use("/", requireAuth, tasksRouter);
app.use("/", requireAuth, commentsRouter);

/**
 * Example: how we want errors shaped.
 * Candidates should re-use this for their implementation.
 */
app.use((req: Request, res: Response) => {
  sendError(res, 404, {
    code: "NOT_FOUND",
    message: `Route not found: ${req.method} ${req.path}`,
  });
});

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 4000);
  app.listen(port, () => {
    console.log(`[api] listening on http://localhost:${port}`);
  });
}

export default app;
