import type { ApiError } from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export class ApiErrorResponse extends Error {
  code?: string;
  details?: ApiError["error"]["details"];

  constructor(message: string, code?: string, details?: ApiError["error"]["details"]) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    credentials: "include",
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : {};

  if (!response.ok) {
    const apiError = data as ApiError;
    throw new ApiErrorResponse(
      apiError?.error?.message ?? "Request failed",
      apiError?.error?.code,
      apiError?.error?.details
    );
  }

  return data as T;
}
