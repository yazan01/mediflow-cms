"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const INACTIVITY_WARN_MS = 25 * 60 * 1000;
const COUNTDOWN_SECONDS = 5 * 60;

interface Props {
  user: { name: string; role: string };
  children: React.ReactNode;
}

export default function DashboardShell({ user, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showTimeout, setShowTimeout] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const router = useRouter();
  const showTimeoutRef = useRef(false);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      showTimeoutRef.current = true;
      setShowTimeout(true);
      setCountdown(COUNTDOWN_SECONDS);
    }, INACTIVITY_WARN_MS);
  }, []);

  const resetInactivity = useCallback(() => {
    if (showTimeoutRef.current) return;
    startInactivityTimer();
  }, [startInactivityTimer]);

  useEffect(() => {
    startInactivityTimer();
    const events = ["mousedown", "keydown", "scroll", "touchstart"] as const;
    const handler = () => resetInactivity();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [startInactivityTimer, resetInactivity]);

  useEffect(() => {
    if (!showTimeout) {
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      return;
    }
    countdownTimer.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownTimer.current!);
          handleLogout();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTimeout]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function handleStay() {
    showTimeoutRef.current = false;
    setShowTimeout(false);
    setCountdown(COUNTDOWN_SECONDS);
    startInactivityTimer();
  }

  return (
    <>
      <div className="flex h-screen bg-[#faf9fd] overflow-hidden">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <Sidebar user={user} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar user={user} onMenuClick={() => setSidebarOpen((v) => !v)} />
          <main className="flex-1 overflow-y-auto p-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </div>

      {showTimeout && (
        <SessionTimeoutModal
          countdown={countdown}
          onStay={handleStay}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}

function SessionTimeoutModal({ countdown, onStay, onLogout }: {
  countdown: number;
  onStay: () => void;
  onLogout: () => void;
}) {
  const { t } = useLanguage();
  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-timeout-title"
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-[#fff7ed] flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-[32px] text-[#d97706]" aria-hidden="true">timer</span>
        </div>
        <h2 id="session-timeout-title" className="text-lg font-bold text-[#1a1c1e] mb-2">
          {t.topbar.sessionExpiring}
        </h2>
        <p className="text-sm text-[#74777f] mb-4">
          {t.topbar.sessionExpiringDesc}
        </p>
        <div className="text-3xl font-bold text-[#1960a3] mb-6 tabular-nums" aria-live="polite" aria-label={`${mins} minutes ${secs} seconds`}>
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </div>
        <div className="flex gap-3">
          <button onClick={onLogout} className="btn-secondary flex-1">
            {t.topbar.signOut}
          </button>
          <button onClick={onStay} className="btn-primary flex-1">
            {t.topbar.stayLoggedIn}
          </button>
        </div>
      </div>
    </div>
  );
}
