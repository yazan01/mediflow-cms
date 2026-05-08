"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { KeyboardShortcutsHelp } from "@/components/KeyboardShortcutsHelp";
import { useKeyboardShortcuts, type Shortcut } from "@/lib/hooks/useKeyboardShortcuts";

const COUNTDOWN_SECONDS = 5 * 60;
const DEFAULT_SESSION_TIMEOUT_MINS = 30;

interface Props {
  user: { name: string; role: string; roles?: string[] };
  children: React.ReactNode;
}

export default function DashboardShell({ user, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showTimeout, setShowTimeout] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const router = useRouter();
  const showTimeoutRef = useRef(false);
  const { t } = useLanguage();

  // Restore persisted preferences after mount
  useEffect(() => {
    const collapsed = localStorage.getItem("mediflow_sidebar_collapsed") === "true";
    const dark      = localStorage.getItem("mediflow_dark") === "true";
    setSidebarCollapsed(collapsed);
    setDarkMode(dark);
  }, []);

  // Apply / remove dark class on <html>
  useEffect(() => {
    const html = document.documentElement;
    if (darkMode) html.classList.add("dark");
    else html.classList.remove("dark");
  }, [darkMode]);

  function toggleCollapsed() {
    setSidebarCollapsed((v) => {
      const next = !v;
      localStorage.setItem("mediflow_sidebar_collapsed", String(next));
      return next;
    });
  }

  function toggleDark() {
    setDarkMode((v) => {
      const next = !v;
      localStorage.setItem("mediflow_dark", String(next));
      return next;
    });
  }

  const shortcuts: Shortcut[] = [
    { key: "n", alt: true, action: () => router.push("/appointments/new"), description: t.common.scNewAppointment, category: "create" },
    { key: "p", alt: true, action: () => router.push("/patients"), description: t.common.scSearchPatients, category: "search" },
    { key: "b", alt: true, action: () => router.push("/billing"), description: t.common.scNewInvoice, category: "create" },
    { key: "h", alt: true, action: () => router.push("/"), description: t.common.scDashboard, category: "navigate" },
    { key: "l", alt: true, action: () => { fetch("/api/auth/logout", { method: "POST" }).then(() => router.push("/login")); }, description: t.common.scLogout, category: "general" },
    { key: "?", alt: true, action: () => setShowShortcuts(true), description: t.common.scViewShortcuts, category: "general" },
  ];

  useKeyboardShortcuts(shortcuts);
  const inactivityMsRef = useRef((DEFAULT_SESSION_TIMEOUT_MINS - 5) * 60 * 1000);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer  = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.sessionTimeout) {
          const mins = Math.max(6, Number(data.sessionTimeout));
          inactivityMsRef.current = (mins - 5) * 60 * 1000;
        }
      })
      .catch(() => {});
  }, []);

  const startInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      showTimeoutRef.current = true;
      setShowTimeout(true);
      setCountdown(COUNTDOWN_SECONDS);
    }, inactivityMsRef.current);
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
        if (c <= 1) { clearInterval(countdownTimer.current!); handleLogout(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => { if (countdownTimer.current) clearInterval(countdownTimer.current); };
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
      <div className="flex h-screen bg-[var(--bg)] overflow-hidden">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-[2px]"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <Sidebar
          user={user}
          roles={user.roles}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={toggleCollapsed}
        />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar
            user={user}
            onMenuClick={() => setSidebarOpen((v) => !v)}
            darkMode={darkMode}
            onToggleDark={toggleDark}
          />
          <main className="flex-1 overflow-y-auto p-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </div>

      {showTimeout && (
        <SessionTimeoutModal countdown={countdown} onStay={handleStay} onLogout={handleLogout} />
      )}

      <ConnectionStatus />

      {showShortcuts && (
        <KeyboardShortcutsHelp shortcuts={shortcuts} onClose={() => setShowShortcuts(false)} />
      )}
    </>
  );
}

function SessionTimeoutModal({ countdown, onStay, onLogout }: {
  countdown: number; onStay: () => void; onLogout: () => void;
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
      <div className="bg-[var(--surface)] rounded-2xl shadow-[var(--sh-xl)] max-w-sm w-full p-6 text-center border border-[var(--border)] animate-scale-in">
        <div className="w-16 h-16 rounded-full bg-[#fff7ed] flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-[32px] text-[#d97706]" aria-hidden="true">timer</span>
        </div>
        <h2 id="session-timeout-title" className="text-lg font-bold text-[var(--txt1)] mb-2">
          {t.topbar.sessionExpiring}
        </h2>
        <p className="text-sm text-[var(--txt3)] mb-4">
          {t.topbar.sessionExpiringDesc}
        </p>
        <div className="text-3xl font-bold text-[#1960a3] mb-6 tabular-nums" aria-live="polite">
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </div>
        <div className="flex gap-3">
          <button onClick={onLogout} className="btn-secondary flex-1">{t.topbar.signOut}</button>
          <button onClick={onStay}   className="btn-primary  flex-1">{t.topbar.stayLoggedIn}</button>
        </div>
      </div>
    </div>
  );
}
