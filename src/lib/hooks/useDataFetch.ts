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

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.detail ?? body.error ?? body.message ?? message;
    } catch { /* ignore parse error */ }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}
