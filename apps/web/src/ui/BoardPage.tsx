import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import type { Board, Column, Comment, Task } from "../lib/types";
import { useAuth } from "../state/auth";

type TasksResponse = {
  items: Task[];
  page: number;
  limit: number;
  total: number;
};

export function BoardPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);

  const boardsQuery = useQuery({
    queryKey: ["boards"],
    queryFn: () => apiFetch<{ boards: Board[] }>("/boards"),
  });

  const boardId = boardsQuery.data?.boards?.[0]?.id ?? "";

  const columnsQuery = useQuery({
    queryKey: ["columns", boardId],
    queryFn: () => apiFetch<{ columns: Column[] }>(`/boards/${boardId}/columns`),
    enabled: Boolean(boardId),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, payload }: { taskId: string; payload: Partial<Task> & { columnId?: string } }) =>
      apiFetch<{ task: Task }>(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: ({ columnId, payload }: { columnId: string; payload: { title: string; description?: string; priority?: Task["priority"] } }) =>
      apiFetch<{ task: Task }>(`/columns/${columnId}/tasks`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["columns", boardId] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => apiFetch(`/tasks/${taskId}`, { method: "DELETE" }),
    onSuccess: () => {
      setSelectedTask(null);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["columns", boardId] });
    },
  });

  const boardName = boardsQuery.data?.boards?.[0]?.name ?? "Board";

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">Team Boards</p>
          <h1>{boardName}</h1>
        </div>
        <div className="topbar-actions">
          <div className="user-badge">{user?.name}</div>
          <button className="btn ghost" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </header>

      <section className="controls">
        <label className="search">
          <span>Search tasks</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title or description"
          />
        </label>
      </section>

      {boardsQuery.isLoading && <div className="panel">Loading boards…</div>}
      {boardsQuery.isError && (
        <div className="panel error">Couldn’t load boards. Try refreshing.</div>
      )}
      {boardsQuery.data?.boards?.length === 0 && (
        <div className="panel muted">
          No boards found. Run the seed script to create demo data.
        </div>
      )}

      {columnsQuery.isLoading && <div className="panel">Loading columns…</div>}
      {columnsQuery.isError && (
        <div className="panel error">Couldn’t load columns. Check the API.</div>
      )}

      {columnsQuery.data && (
        <div className="board">
          {columnsQuery.data.columns.map((column) => (
            <TaskColumn
              key={column.id}
              column={column}
              search={search}
              onSelectTask={setSelectedTask}
              onCreateTask={(payload) => createTaskMutation.mutate({ columnId: column.id, payload })}
              onMoveTask={(taskId, columnId) =>
                updateTaskMutation.mutate({ taskId, payload: { columnId } })
              }
              columns={columnsQuery.data.columns}
            />
          ))}
        </div>
      )}

      {selectedTask && columnsQuery.data && (
        <TaskDetails
          task={selectedTask}
          columns={columnsQuery.data.columns}
          onClose={() => setSelectedTask(null)}
          onUpdate={(payload) =>
            updateTaskMutation.mutate({ taskId: selectedTask.id, payload })
          }
          onDelete={() => deleteTaskMutation.mutate(selectedTask.id)}
          onTaskUpdated={(task) => setSelectedTask(task)}
        />
      )}
    </div>
  );
}

const priorityLabel = (priority: Task["priority"] | string | number | null | undefined) => {
  if (!priority) return "Medium";
  if (typeof priority === "number") {
    return priority <= 2 ? "Low" : priority >= 4 ? "High" : "Medium";
  }
  const value = String(priority).toLowerCase();
  if (value === "low" || value === "medium" || value === "high") {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  return "Medium";
};

function TaskColumn({
  column,
  search,
  onSelectTask,
  onCreateTask,
  onMoveTask,
  columns,
}: {
  column: Column;
  search: string;
  onSelectTask: (task: Task) => void;
  onCreateTask: (payload: { title: string; description?: string; priority?: Task["priority"] }) => void;
  onMoveTask: (taskId: string, columnId: string) => void;
  columns: Column[];
}) {
  const [title, setTitle] = React.useState("");
  const tasksQuery = useQuery({
    queryKey: ["tasks", column.id, search],
    queryFn: () =>
      apiFetch<TasksResponse>(
        `/columns/${column.id}/tasks?search=${encodeURIComponent(search)}&page=1&limit=20`
      ),
  });

  const handleCreate = () => {
    if (!title.trim()) return;
    onCreateTask({ title: title.trim() });
    setTitle("");
  };

  return (
    <div className="column">
      <div className="column-header">
        <div>
          <h2>{column.name}</h2>
          <span className="meta">{tasksQuery.data?.total ?? column.taskCount} tasks</span>
        </div>
      </div>

      <div className="column-body">
        {tasksQuery.isLoading && <div className="card muted">Loading tasks…</div>}
        {tasksQuery.isError && <div className="card error">Error loading tasks</div>}
        {tasksQuery.data && tasksQuery.data.items.length === 0 && (
          <div className="card muted">No tasks yet.</div>
        )}
        {tasksQuery.data?.items.map((task) => (
          <button key={task.id} className="task" onClick={() => onSelectTask(task)}>
            <div>
              <strong>{task.title}</strong>
              {task.description && <p>{task.description}</p>}
            </div>
            <div className="task-meta">
              <span>Priority {priorityLabel(task.priority)}</span>
              <label>
                <span className="sr-only">Move task</span>
                <select
                  value={task.columnId}
                  onChange={(event) => onMoveTask(task.id, event.target.value)}
                >
                  {columns.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </button>
        ))}
      </div>

      <div className="column-footer">
        <label>
          <span className="sr-only">New task title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add a task"
          />
        </label>
        <button className="btn" onClick={handleCreate}>
          Add
        </button>
      </div>
    </div>
  );
}

function TaskDetails({
  task,
  columns,
  onClose,
  onUpdate,
  onDelete,
  onTaskUpdated,
}: {
  task: Task;
  columns: Column[];
  onClose: () => void;
  onUpdate: (payload: Partial<Task> & { columnId?: string }) => void;
  onDelete: () => void;
  onTaskUpdated: (task: Task) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    title: task.title,
    description: task.description ?? "",
    priority: (typeof task.priority === "string"
      ? task.priority
      : task.priority >= 4
        ? "high"
        : task.priority <= 2
          ? "low"
          : "medium") as Task["priority"],
    columnId: task.columnId,
  });
  const [comment, setComment] = React.useState("");

  React.useEffect(() => {
    setForm({
      title: task.title,
      description: task.description ?? "",
      priority: (typeof task.priority === "string"
        ? task.priority
        : task.priority >= 4
          ? "high"
          : task.priority <= 2
            ? "low"
            : "medium") as Task["priority"],
      columnId: task.columnId,
    });
  }, [task]);

  const commentsQuery = useQuery({
    queryKey: ["comments", task.id],
    queryFn: () => apiFetch<{ comments: Comment[] }>(`/tasks/${task.id}/comments`),
  });

  const addCommentMutation = useMutation({
    mutationFn: (payload: { body: string }) =>
      apiFetch<{ comment: Comment }>(`/tasks/${task.id}/comments`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setComment("");
      void queryClient.invalidateQueries({ queryKey: ["comments", task.id] });
    },
  });

  const handleSave = () => {
    onUpdate({
      title: form.title,
      description: form.description || undefined,
      priority: form.priority,
      columnId: form.columnId,
    });
    onTaskUpdated({
      ...task,
      title: form.title,
      description: form.description,
  priority: form.priority,
      columnId: form.columnId,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <aside className="drawer">
      <div className="drawer-header">
        <div>
          <p className="eyebrow">Task details</p>
          <h3>{task.title}</h3>
        </div>
        <button className="btn ghost" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="drawer-section">
        <label>
          <span>Title</span>
          <input
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </label>
        <label>
          <span>Description</span>
          <textarea
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            rows={4}
          />
        </label>
        <div className="form-row">
          <label>
            <span>Priority</span>
            <select
              value={form.priority}
              onChange={(event) =>
                setForm({ ...form, priority: event.target.value as Task["priority"] })
              }
            >
              {["low", "medium", "high"].map((value) => (
                <option key={value} value={value}>
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Column</span>
            <select
              value={form.columnId}
              onChange={(event) => setForm({ ...form, columnId: event.target.value })}
            >
              {columns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-actions">
          <button className="btn" onClick={handleSave}>
            Save changes
          </button>
          <button className="btn ghost danger" onClick={onDelete}>
            Delete task
          </button>
        </div>
      </div>

      <div className="drawer-section">
        <h4>Comments</h4>
        {commentsQuery.isLoading && <p className="muted">Loading comments…</p>}
        {commentsQuery.isError && <p className="error">Couldn’t load comments.</p>}
        {commentsQuery.data?.comments.length === 0 && (
          <p className="muted">No comments yet.</p>
        )}
        <div className="comments">
          {commentsQuery.data?.comments.map((item) => (
            <div key={item.id} className="comment">
              <div>
                <strong>{item.authorName}</strong>
                <span>{new Date(item.createdAt).toLocaleString()}</span>
              </div>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
        <label>
          <span>Add a comment</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
          />
        </label>
        <button
          className="btn"
          onClick={() => comment.trim() && addCommentMutation.mutate({ body: comment.trim() })}
        >
          Post comment
        </button>
      </div>
    </aside>
  );
}
