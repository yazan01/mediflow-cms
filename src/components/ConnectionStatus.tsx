"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { checkHealth } from "@/lib/api-client";

export function ConnectionStatus() {
  const [offline, setOffline] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runCheck = useCallback(async () => {
    const ok = await checkHealth();
    if (ok) {
      setOffline(false);
      setRetrying(false);
      setAttempt(0);
    } else {
      setOffline(true);
    }
  }, []);

  // Poll every 60s
  useEffect(() => {
    intervalRef.current = setInterval(runCheck, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [runCheck]);

  // Browser online/offline events
  useEffect(() => {
    const handleOffline = () => setOffline(true);
    const handleOnline = () => runCheck();
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [runCheck]);

  const handleRetry = async () => {
    setRetrying(true);
    setAttempt((a) => a + 1);
    await runCheck();
    setRetrying(false);
  };

  if (!offline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-4 start-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl px-5 py-3 shadow-lg bg-[#ba1a1a] text-white text-sm font-medium"
    >
      <span className="material-symbols-outlined text-base">wifi_off</span>
      <span>تعذّر الاتصال بالخادم — تحقق من تشغيل النظام</span>
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="ms-2 rounded-lg border border-white/40 px-3 py-1 text-xs hover:bg-white/20 disabled:opacity-50 transition-colors"
        aria-label="إعادة المحاولة"
      >
        {retrying ? "جارٍ المحاولة..." : "إعادة المحاولة"}
      </button>
    </div>
  );
}
