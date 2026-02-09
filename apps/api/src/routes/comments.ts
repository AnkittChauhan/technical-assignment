import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getDb } from "../db";
import { parseBody } from "../validation";
import { sendError } from "../errors";
import { wrap } from "../http";
import type { AuthedRequest } from "../auth";

const router = Router();

const createCommentSchema = z.object({
  body: z.string().min(1),
});

router.get(
  "/tasks/:taskId/comments",
  wrap((req, res) => {
    const task = getDb().prepare("SELECT id FROM tasks WHERE id = ?").get(req.params.taskId);
    if (!task) {
      sendError(res, 404, { code: "NOT_FOUND", message: "Task not found" });
      return;
    }

    const comments = getDb()
      .prepare(
        `
        SELECT comments.id,
               comments.task_id as taskId,
               comments.body,
               comments.created_at as createdAt,
               users.id as authorId,
               users.name as authorName
        FROM comments
        JOIN users ON users.id = comments.author_id
        WHERE comments.task_id = ?
        ORDER BY comments.created_at ASC
      `
      )
      .all(req.params.taskId);

    res.json({ comments });
  })
);

router.post(
  "/tasks/:taskId/comments",
  wrap((req, res) => {
    const body = parseBody(createCommentSchema, req.body, res);
    if (!body) return;

    const task = getDb().prepare("SELECT id FROM tasks WHERE id = ?").get(req.params.taskId);
    if (!task) {
      sendError(res, 404, { code: "NOT_FOUND", message: "Task not found" });
      return;
    }

  const commentId = randomUUID();
    const now = new Date().toISOString();
    const user = (req as AuthedRequest).user;

    getDb()
      .prepare(
        "INSERT INTO comments (id, task_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)"
      )
      .run(commentId, req.params.taskId, user.id, body.body, now);

    res.status(201).json({
      comment: {
        id: commentId,
        taskId: req.params.taskId,
        body: body.body,
        createdAt: now,
        authorId: user.id,
        authorName: user.name,
      },
    });
  })
);

export default router;
