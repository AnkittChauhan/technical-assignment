import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { getDb, initDb } from "./db";

function seed() {
  initDb();
  const db = getDb();

  const existing = db.prepare("SELECT COUNT(*) as count FROM boards").get() as {
    count: number;
  };

  if (existing.count > 0) {
    console.log("[seed] data already exists, skipping");
    return;
  }

  const now = new Date().toISOString();
  const userId = randomUUID();
  const boardId = randomUUID();

  db.prepare(
    "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(userId, "demo@teamboards.dev", "Demo User", bcrypt.hashSync("password123", 10), now);

  db.prepare("INSERT INTO boards (id, name, owner_id, created_at) VALUES (?, ?, ?, ?)").run(
    boardId,
    "Demo Board",
    userId,
    now
  );

  const columns = [
    { name: "Backlog", position: 0 },
    { name: "In Progress", position: 1 },
    { name: "Done", position: 2 },
  ].map((column) => ({ ...column, id: randomUUID() }));

  const insertColumn = db.prepare(
    "INSERT INTO columns (id, board_id, name, position, created_at) VALUES (?, ?, ?, ?, ?)"
  );

  for (const column of columns) {
    insertColumn.run(column.id, boardId, column.name, column.position, now);
  }

  const tasks = [
    {
      columnId: columns[0].id,
      title: "Sketch initial board layout",
      description: "Create three columns and basic task cards.",
      priority: "high",
    },
    {
      columnId: columns[0].id,
      title: "Write auth endpoints",
      description: "Register/login with JWT cookies.",
      priority: "high",
    },
    {
      columnId: columns[1].id,
      title: "Build task details panel",
      description: "Include comments and edit form.",
      priority: "medium",
    },
    {
      columnId: columns[2].id,
      title: "Polish empty states",
      description: "Add friendly copy and icons.",
      priority: "low",
    },
  ];

  const insertTask = db.prepare(
    "INSERT INTO tasks (id, column_id, title, description, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );

  const taskIds: string[] = [];
  for (const task of tasks) {
    const taskId = randomUUID();
    taskIds.push(taskId);
    insertTask.run(taskId, task.columnId, task.title, task.description, task.priority, now, now);
  }

  const insertComment = db.prepare(
    "INSERT INTO comments (id, task_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)"
  );

  insertComment.run(
    randomUUID(),
    taskIds[0],
    userId,
    "Remember to keep empty states accessible.",
    now
  );

  console.log("[seed] demo data inserted");
}

seed();
