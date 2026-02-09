import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getDb } from "../db";
import { parseBody } from "../validation";
import { sendError } from "../errors";
import { wrap } from "../http";

const router = Router();

const prioritySchema = z.enum(["low", "medium", "high"]);

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: prioritySchema.optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: prioritySchema.optional(),
  columnId: z.string().uuid().optional(),
});

router.get(
  "/columns/:columnId/tasks",
  wrap((req, res) => {
    const { search = "", page = "1", limit = "20", sort = "createdAt" } = req.query as {
      search?: string;
      page?: string;
      limit?: string;
      sort?: string;
    };

    const column = getDb()
      .prepare("SELECT id FROM columns WHERE id = ?")
      .get(req.params.columnId);
    if (!column) {
      sendError(res, 404, { code: "NOT_FOUND", message: "Column not found" });
      return;
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(50, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;
    const searchTerm = `%${search}%`;

    const orderBy =
      sort === "priority"
        ? "CASE priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END DESC"
        : "created_at DESC";

    const totalRow = getDb()
      .prepare(
        "SELECT COUNT(*) as total FROM tasks WHERE column_id = ? AND (title LIKE ? OR COALESCE(description, '') LIKE ?)"
      )
      .get(req.params.columnId, searchTerm, searchTerm) as { total: number };

    const items = getDb()
      .prepare(
        `
          SELECT id,
                 column_id as columnId,
                 title,
                 description,
                 priority,
                 created_at as createdAt,
                 updated_at as updatedAt
          FROM tasks
          WHERE column_id = ? AND (title LIKE ? OR COALESCE(description, '') LIKE ?)
          ORDER BY ${orderBy}
          LIMIT ? OFFSET ?
        `
      )
      .all(req.params.columnId, searchTerm, searchTerm, limitNum, offset);

    res.json({
      items,
      page: pageNum,
      limit: limitNum,
      total: totalRow.total,
    });
  })
);

router.post(
  "/columns/:columnId/tasks",
  wrap((req, res) => {
    const body = parseBody(createTaskSchema, req.body, res);
    if (!body) return;

    const column = getDb()
      .prepare("SELECT id FROM columns WHERE id = ?")
      .get(req.params.columnId);
    if (!column) {
      sendError(res, 404, { code: "NOT_FOUND", message: "Column not found" });
      return;
    }

    const taskId = randomUUID();
    const now = new Date().toISOString();
    const priority = body.priority ?? "medium";

    getDb()
      .prepare(
        "INSERT INTO tasks (id, column_id, title, description, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(taskId, req.params.columnId, body.title, body.description ?? null, priority, now, now);

    res.status(201).json({
      task: {
        id: taskId,
        columnId: req.params.columnId,
        title: body.title,
        description: body.description ?? null,
        priority,
        createdAt: now,
        updatedAt: now,
      },
    });
  })
);

router.patch(
  "/tasks/:taskId",
  wrap((req, res) => {
    const body = parseBody(updateTaskSchema, req.body, res);
    if (!body) return;

    const task = getDb()
      .prepare(
        "SELECT id, column_id as columnId, title, description, priority, created_at as createdAt FROM tasks WHERE id = ?"
      )
      .get(req.params.taskId) as
      | {
          id: string;
          columnId: string;
          title: string;
          description: string | null;
          priority: string;
          createdAt: string;
        }
      | undefined;

    if (!task) {
      sendError(res, 404, { code: "NOT_FOUND", message: "Task not found" });
      return;
    }

    if (body.columnId) {
      const targetColumn = getDb()
        .prepare("SELECT id FROM columns WHERE id = ?")
        .get(body.columnId);
      if (!targetColumn) {
        sendError(res, 404, { code: "NOT_FOUND", message: "Target column not found" });
        return;
      }
    }

    const next = {
      title: body.title ?? task.title,
      description: body.description ?? task.description,
      priority: body.priority ?? task.priority,
      columnId: body.columnId ?? task.columnId,
      updatedAt: new Date().toISOString(),
    };

    getDb()
      .prepare(
        "UPDATE tasks SET title = ?, description = ?, priority = ?, column_id = ?, updated_at = ? WHERE id = ?"
      )
      .run(next.title, next.description, next.priority, next.columnId, next.updatedAt, task.id);

    res.json({
      task: {
        id: task.id,
        columnId: next.columnId,
        title: next.title,
        description: next.description,
        priority: next.priority,
        createdAt: task.createdAt,
        updatedAt: next.updatedAt,
      },
    });
  })
);

router.delete(
  "/tasks/:taskId",
  wrap((req, res) => {
    const task = getDb().prepare("SELECT id FROM tasks WHERE id = ?").get(req.params.taskId);
    if (!task) {
      sendError(res, 404, { code: "NOT_FOUND", message: "Task not found" });
      return;
    }

    getDb().prepare("DELETE FROM tasks WHERE id = ?").run(req.params.taskId);
    res.json({ ok: true });
  })
);

export default router;
