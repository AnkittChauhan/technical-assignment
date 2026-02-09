export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: Array<{ path: string; issue: string }> | unknown;
  };
};

export type User = {
  id: string;
  email: string;
  name: string;
};

export type Board = {
  id: string;
  name: string;
  ownerId: string;
};

export type Column = {
  id: string;
  boardId: string;
  name: string;
  position: number;
  taskCount: number;
};

export type Task = {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  createdAt: string;
  updatedAt: string;
};

export type Comment = {
  id: string;
  taskId: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
};
