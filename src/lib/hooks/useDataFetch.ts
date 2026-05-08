"use client";

import { useState, useCallback } from "react";

export type FetchError =
  | { type: "network"; message: string }
  | { type: "api"; status: number; message: string };

export function useFetchState<T>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FetchError | null>(null);

  const execute = useCallback(async (fn: () => Promise<T>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      setData(result);
      return result;
    } catch (err) {
      if (err instanceof ApiError) {
        setError({ type: "api", status: err.status, message: err.message });
      } else {
        setError({ type: "network", message: "Unable to connect. Check your network." });
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, execute, setData };
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

function _getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)mediflow_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

const _MUTATION_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? "GET").toUpperCase();
  const headers = new Headers(options?.headers);

  if (_MUTATION_METHODS.has(method)) {
    const csrf = _getCsrfToken();
    if (csrf) headers.set("X-CSRF-Token", csrf);
    if (!headers.has("Content-Type") && !(options?.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
  }

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.detail ?? body.error ?? body.message ?? message;
    } catch { /* ignore parse error */ }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
