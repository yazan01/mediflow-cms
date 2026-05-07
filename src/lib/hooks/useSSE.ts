"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type SSEStatus = "connecting" | "connected" | "disconnected";

export function useSSE<T>(url: string, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<SSEStatus>("disconnected");
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);

  const connect = useCallback(() => {
    if (!enabled || typeof window === "undefined") return;
    if (esRef.current) {
      esRef.current.close();
    }

    setStatus("connecting");
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.onopen = () => {
      setStatus("connected");
      retryCount.current = 0;
    };

    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as { type: string; payload: T };
        setData(parsed.payload);
      } catch {
        // ignore malformed
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setStatus("disconnected");
      // Exponential backoff: 2s, 4s, 8s … max 30s
      const delay = Math.min(2000 * Math.pow(2, retryCount.current), 30000);
      retryCount.current += 1;
      retryRef.current = setTimeout(connect, delay);
    };
  }, [url, enabled]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [connect]);

  return { data, status };
}
