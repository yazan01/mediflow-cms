"use client";

import { ApiError } from "./hooks/useDataFetch";

export type RequestErrorType = "network" | "server" | "auth" | "validation";

export interface RequestError extends Error {
  type: RequestErrorType;
  status?: number;
}

function createError(type: RequestErrorType, message: string, status?: number): RequestError {
  const err = new Error(message) as RequestError;
  err.type = type;
  err.status = status;
  return err;
}

const RETRY_DELAYS = [1000, 2000, 4000]; // ms

export async function apiFetchWithRetry<T>(
  url: string,
  options?: RequestInit,
  onRetry?: (attempt: number) => void,
): Promise<T> {
  let lastError: RequestError | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const res = await fetch(url, options);

      if (res.status === 401) {
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        throw createError("auth", "Session expired. Redirecting to login.", 401);
      }

      if (!res.ok) {
        let message = `Request failed (${res.status})`;
        try {
          const body = await res.json();
          message = body.detail ?? body.error ?? body.message ?? message;
        } catch { /* ignore */ }

        if (res.status >= 500) {
          lastError = createError("server", message, res.status);
          if (attempt < RETRY_DELAYS.length) {
            onRetry?.(attempt + 1);
            await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
            continue;
          }
          throw lastError;
        }

        if (res.status === 422) {
          throw createError("validation", message, res.status);
        }

        throw createError("server", message, res.status);
      }

      return res.json() as Promise<T>;
    } catch (err) {
      if ((err as RequestError).type) {
        throw err; // already typed, don't retry auth/validation
      }
      // Network error (fetch threw)
      lastError = createError("network", "Unable to connect to server. Check your network.");
      if (attempt < RETRY_DELAYS.length) {
        onRetry?.(attempt + 1);
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? createError("network", "Request failed after retries.");
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}
