"use client";

import { getFirebaseAuth } from "@/lib/firebase";

// Always relative — this module only ever runs in the browser ("use client"
// above), and next.config.mjs's rewrite proxies /api/v1/* to the real
// backend origin server-side. A direct browser fetch to the backend's own
// origin would be blocked as mixed content on Vercel (HTTPS page, plain-HTTP
// droplet) — see next.config.mjs's rewrites() for the full explanation.
const BASE_URL = "";

export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

type StructuredError = { code: string; message: string; details?: unknown };

function isStructuredError(value: unknown): value is StructuredError {
  return !!value && typeof value === "object" && "code" in value && "message" in value;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = await authHeader();
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...headers,
      ...init.headers,
    },
  });

  // 204 No Content (e.g. DELETE) has no body to parse.
  if (response.status === 204) return undefined as T;

  const body = (await response.json().catch(() => null)) as
    | { success: true; data: T; message: string | null }
    | { success: false; error: StructuredError }
    | { error: string | StructuredError }
    | null;

  const bodyError = body && "error" in body ? body.error : undefined;

  if (!response.ok) {
    if (isStructuredError(bodyError)) {
      throw new ApiError(response.status, bodyError.code, bodyError.message, bodyError.details);
    }
    throw new ApiError(response.status, "HTTP_ERROR", typeof bodyError === "string" ? bodyError : response.statusText);
  }

  if (body && "success" in body) {
    if (body.success === false) {
      const failure = body as { success: false; error: StructuredError };
      throw new ApiError(response.status, failure.error.code, failure.error.message, failure.error.details);
    }
    return (body as { success: true; data: T }).data;
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
