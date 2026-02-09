import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getDb } from "../db";
import { parseBody } from "../validation";
import { sendError } from "../errors";
import { wrap } from "../http";

const router = Router();

const createColumnSchema = z.object({
  name: z.string().min(1),
  position: z.number().int().min(0),
});

router.get(
  "/",
  wrap((_req, res) => {
    const boards = getDb()
      .prepare("SELECT id, name, owner_id as ownerId FROM boards ORDER BY created_at ASC")
      .all();
    res.json({ boards });
  })
);

router.get(
  "/:boardId",
  wrap((req, res) => {
    const board = getDb()
      .prepare("SELECT id, name, owner_id as ownerId FROM boards WHERE id = ?")
      .get(req.params.boardId);

    if (!board) {
      sendError(res, 404, { code: "NOT_FOUND", message: "Board not found" });
      return;
    }

    res.json({ board });
  })
);

router.get(
  "/:boardId/columns",
  wrap((req, res) => {
    const columns = getDb()
      .prepare(
        `
          SELECT columns.id,
                 columns.board_id as boardId,
                 columns.name,
                 columns.position,
                 COUNT(tasks.id) as taskCount
          FROM columns
          LEFT JOIN tasks ON tasks.column_id = columns.id
          WHERE columns.board_id = ?
          GROUP BY columns.id
          ORDER BY columns.position ASC
        `
      )
      .all(req.params.boardId);

    res.json({ columns });
  })
);

router.post(
  "/:boardId/columns",
  wrap((req, res) => {
    const body = parseBody(createColumnSchema, req.body, res);
    if (!body) return;

    const board = getDb()
      .prepare("SELECT id FROM boards WHERE id = ?")
      .get(req.params.boardId);
    if (!board) {
      sendError(res, 404, { code: "NOT_FOUND", message: "Board not found" });
      return;
    }

  const columnId = randomUUID();
    const now = new Date().toISOString();

    getDb()
      .prepare(
        "INSERT INTO columns (id, board_id, name, position, created_at) VALUES (?, ?, ?, ?, ?)"
      )
      .run(columnId, req.params.boardId, body.name, body.position, now);

    res.status(201).json({
      column: {
        id: columnId,
        boardId: req.params.boardId,
        name: body.name,
        position: body.position,
        taskCount: 0,
      },
    });
  })
);

export default router;
