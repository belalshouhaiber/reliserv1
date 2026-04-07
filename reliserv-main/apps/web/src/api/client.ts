const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export type ApiError = Error & {
  status: number;
  body?: unknown;
};

type JsonBody = Record<string, unknown> | unknown[];

type ApiOptions = Omit<RequestInit, "body"> & {
  auth?: boolean;
  body?: RequestInit["body"] | JsonBody;
};

function shouldSerializeBody(body: unknown): body is Record<string, unknown> | unknown[] {
  if (body == null) return false;
  if (typeof body !== "object") return false;
  if (body instanceof FormData) return false;
  if (body instanceof URLSearchParams) return false;
  if (body instanceof Blob) return false;
  if (body instanceof ArrayBuffer) return false;
  return true;
}

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export async function api<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { auth = true, headers, body, ...requestInit } = options;
  const token = auth ? getToken() : null;
  const requestBody = shouldSerializeBody(body) ? JSON.stringify(body) : body;

  const res = await fetch(`${API_BASE}${path}`, {
    ...requestInit,
    body: requestBody,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
  });

  if (!res.ok) {
    let body: unknown;
    let message = `Request failed: ${res.status}`;

    try {
      body = await res.json();
      if (body && typeof body === "object") {
        const errorBody = body as { error?: string; message?: string };
        message = errorBody.error || errorBody.message || message;
      }
    } catch {
      // ignore JSON parse errors
    }

    if (res.status === 401) {
      localStorage.removeItem("token");
    }

    const error = new Error(message) as ApiError;
    error.status = res.status;
    error.body = body;
    throw error;
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json() as Promise<T>;
}
