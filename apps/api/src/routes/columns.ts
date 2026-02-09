import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db";
import { parseBody } from "../validation";
import { sendError } from "../errors";
import { wrap } from "../http";

const router = Router();

const updateColumnSchema = z.object({
  name: z.string().min(1).optional(),
  position: z.number().int().min(0).optional(),
});

router.patch(
  "/:columnId",
  wrap((req, res) => {
    const body = parseBody(updateColumnSchema, req.body, res);
    if (!body) return;

    const column = getDb()
      .prepare("SELECT id, board_id as boardId, name, position FROM columns WHERE id = ?")
      .get(req.params.columnId) as
      | { id: string; boardId: string; name: string; position: number }
      | undefined;

    if (!column) {
      sendError(res, 404, { code: "NOT_FOUND", message: "Column not found" });
      return;
    }

    const next = {
      name: body.name ?? column.name,
      position: body.position ?? column.position,
    };

    getDb()
      .prepare("UPDATE columns SET name = ?, position = ? WHERE id = ?")
      .run(next.name, next.position, column.id);

    res.json({ column: { ...column, ...next } });
  })
);

router.delete(
  "/:columnId",
  wrap((req, res) => {
    const column = getDb().prepare("SELECT id FROM columns WHERE id = ?").get(req.params.columnId);
    if (!column) {
      sendError(res, 404, { code: "NOT_FOUND", message: "Column not found" });
      return;
    }

    getDb().prepare("DELETE FROM columns WHERE id = ?").run(req.params.columnId);
    res.json({ ok: true });
  })
);

export default router;
