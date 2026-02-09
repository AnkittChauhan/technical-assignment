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
  const [dragTaskId, setDragTaskId] = React.useState<string | null>(null);
  const [dragSourceColumnId, setDragSourceColumnId] = React.useState<string | null>(null);

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
          <div className="user-badge">
            <div className="user-avatar">{user?.name?.charAt(0).toUpperCase() ?? "U"}</div>
            {user?.name}
          </div>
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

      {boardsQuery.isLoading && <div className="spinner">Loading boards…</div>}
      {boardsQuery.isError && (
        <div className="panel error">Couldn't load boards. Try refreshing.</div>
      )}
      {boardsQuery.data?.boards?.length === 0 && (
        <div className="panel muted">
          No boards found. Run the seed script to create demo data.
        </div>
      )}

      {columnsQuery.isLoading && <div className="spinner">Loading columns…</div>}
      {columnsQuery.isError && (
        <div className="panel error">Couldn't load columns. Check the API.</div>
      )}

      {columnsQuery.data && (
        <div className="board">
          {columnsQuery.data.columns.map((column, index) => (
            <TaskColumn
              key={column.id}
              column={column}
              columnIndex={index}
              search={search}
              onSelectTask={setSelectedTask}
              onCreateTask={(payload) => createTaskMutation.mutate({ columnId: column.id, payload })}
              onMoveTask={(taskId, columnId) =>
                updateTaskMutation.mutate({ taskId, payload: { columnId } })
              }
              columns={columnsQuery.data.columns}
              dragTaskId={dragTaskId}
              dragSourceColumnId={dragSourceColumnId}
              onDragStart={(taskId, sourceColumnId) => {
                setDragTaskId(taskId);
                setDragSourceColumnId(sourceColumnId);
              }}
              onDragEnd={() => {
                setDragTaskId(null);
                setDragSourceColumnId(null);
              }}
            />
          ))}
        </div>
      )}

      {selectedTask && columnsQuery.data && (
        <>
          <div className="drawer-backdrop" onClick={() => setSelectedTask(null)} />
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
        </>
      )}
    </div>
  );
}

const priorityLabel = (priority: Task["priority"] | string | number | null | undefined): string => {
  if (!priority) return "medium";
  if (typeof priority === "number") {
    return priority <= 2 ? "low" : priority >= 4 ? "high" : "medium";
  }
  const value = String(priority).toLowerCase();
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return "medium";
};

const priorityDisplay = (priority: Task["priority"] | string | number | null | undefined): string => {
  const label = priorityLabel(priority);
  return label.charAt(0).toUpperCase() + label.slice(1);
};

function TaskColumn({
  column,
  columnIndex,
  search,
  onSelectTask,
  onCreateTask,
  onMoveTask,
  columns,
  dragTaskId,
  dragSourceColumnId,
  onDragStart,
  onDragEnd,
}: {
  column: Column;
  columnIndex: number;
  search: string;
  onSelectTask: (task: Task) => void;
  onCreateTask: (payload: { title: string; description?: string; priority?: Task["priority"] }) => void;
  onMoveTask: (taskId: string, columnId: string) => void;
  columns: Column[];
  dragTaskId: string | null;
  dragSourceColumnId: string | null;
  onDragStart: (taskId: string, sourceColumnId: string) => void;
  onDragEnd: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [isDragOver, setIsDragOver] = React.useState(false);
  const dragCounter = React.useRef(0);

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

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    dragCounter.current += 1;
    if (dragTaskId && dragSourceColumnId !== column.id) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragOver(false);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);
    const taskId = event.dataTransfer.getData("text/plain");
    if (taskId && taskId !== "") {
      onMoveTask(taskId, column.id);
    }
    onDragEnd();
  };

  const taskCount = tasksQuery.data?.total ?? column.taskCount;

  return (
    <div className="column">
      <div className="column-header">
        <h2>
          <span className={`column-dot col-${columnIndex}`} />
          {column.name}
        </h2>
        <span className="column-count">{taskCount}</span>
      </div>

      <div
        className={`column-body${isDragOver ? " drag-over" : ""}`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragOver && <div className="drop-placeholder" />}
        {tasksQuery.isLoading && <div className="spinner">Loading…</div>}
        {tasksQuery.isError && <div className="card error">Error loading tasks</div>}
        {tasksQuery.data && tasksQuery.data.items.length === 0 && !isDragOver && (
          <div className="empty-state">
            <span className="empty-icon">📋</span>
            No tasks yet
          </div>
        )}
        {tasksQuery.data?.items.map((task) => (
          <button
            key={task.id}
            className={`task${dragTaskId === task.id ? " dragging" : ""}`}
            draggable
            onClick={() => onSelectTask(task)}
            onDragStart={(event) => {
              event.dataTransfer.setData("text/plain", task.id);
              event.dataTransfer.effectAllowed = "move";
              onDragStart(task.id, column.id);
            }}
            onDragEnd={() => {
              onDragEnd();
              setIsDragOver(false);
            }}
          >
            <strong>{task.title}</strong>
            {task.description && <p>{task.description}</p>}
            <div className="task-meta">
              <span className={`priority-badge ${priorityLabel(task.priority)}`}>
                {priorityDisplay(task.priority)}
              </span>
              <select
                className="move-select"
                value={task.columnId}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => onMoveTask(task.id, event.target.value)}
              >
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>
          </button>
        ))}
      </div>

      <div className="column-footer">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Add a task…"
          onKeyDown={(event) => event.key === "Enter" && handleCreate()}
        />
        <button className="btn sm" onClick={handleCreate}>
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
          ✕
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
        {commentsQuery.isLoading && <p className="spinner">Loading comments…</p>}
        {commentsQuery.isError && <p className="error">Couldn't load comments.</p>}
        {commentsQuery.data?.comments.length === 0 && (
          <p className="muted">No comments yet. Be the first to add one.</p>
        )}
        <div className="comments">
          {commentsQuery.data?.comments.map((item) => (
            <div key={item.id} className="comment">
              <div className="comment-header">
                <div className="comment-avatar">
                  {item.authorName?.charAt(0).toUpperCase() ?? "?"}
                </div>
                <strong>{item.authorName}</strong>
                <span className="comment-time">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
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
            placeholder="Write a comment…"
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