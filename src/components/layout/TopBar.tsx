"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getInitials } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { GlobalSearch } from "@/components/GlobalSearch";

interface TopBarProps {
  user?: { name: string; role: string; photo?: string };
  onMenuClick?: () => void;
}

type ApiNotif = {
  id: string;
  type: string;
  icon: string;
  iconColor: string;
  title: string;
  titleData: string | null;
  message: string;
  messageData: Record<string, string | number>;
  link: string;
  createdAt: string;
  unread: boolean;
};

const ICON_COLOR_MAP: Record<string, string> = {
  "#d97706": "text-[#d97706]",
  "#ba1a1a": "text-[#ba1a1a]",
  "#1960a3": "text-[#1960a3]",
  "#0d9488": "text-[#0d9488]",
};

function interpolate(template: string, data: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(data[key] ?? ""));
}

function timeAgo(isoStr: string, t: { justNow: string; minutesAgo: string; hoursAgo: string; daysAgo: string }): string {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60) return t.justNow;
  if (diff < 3600) return interpolate(t.minutesAgo, { n: Math.floor(diff / 60) });
  if (diff < 86400) return interpolate(t.hoursAgo, { n: Math.floor(diff / 3600) });
  return interpolate(t.daysAgo, { n: Math.floor(diff / 86400) });
}

export default function TopBar({ user, onMenuClick }: TopBarProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { t, lang, setLang } = useLanguage();

  const [notifications, setNotifications] = useState<ApiNotif[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const unreadCount = notifications.filter((n) => n.unread && !readIds.has(n.id)).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.data ?? []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Open global search with "/" key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === "/" && target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  function markAllRead() {
    setReadIds(new Set(notifications.map((n) => n.id)));
  }

  const displayName = user?.name ?? "User";
  const displayRole = user?.role ?? "Staff";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function toggleLang() {
    setLang(lang === "en" ? "ar" : "en");
  }

  function sanitizeLink(link: string): string {
    try {
      const url = new URL(link, window.location.href);
      if (url.protocol === "javascript:") return "/";
      return link;
    } catch {
      return "/";
    }
  }

  function resolveTitle(n: ApiNotif): string {
    const key = n.title as keyof typeof t.topbar;
    const base = (t.topbar[key] as string) ?? n.title;
    return n.titleData ? `${base}: ${n.titleData}` : base;
  }

  function resolveMsg(n: ApiNotif): string {
    const key = n.message as keyof typeof t.topbar;
    const template = (t.topbar[key] as string) ?? n.message;
    return interpolate(template, n.messageData);
  }

  return (
    <>
      <header className="flex justify-between items-center w-full h-16 px-6 sticky top-0 z-40 bg-[#faf9fd] border-b border-[#e3e2e6] print:hidden">
        <div className="flex items-center gap-4 flex-1">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="md:hidden p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors"
              aria-label={t.topbar.openMenu}
            >
              <span className="material-symbols-outlined text-[#43474e]" aria-hidden="true">menu</span>
            </button>
          )}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 w-full max-w-md bg-[#f4f3f7] rounded-full py-2 ps-4 pe-4 text-sm text-[#74777f] hover:bg-[#ebebef] transition-colors"
            aria-label={t.common.searchLabel}
          >
            <span className="material-symbols-outlined text-[18px]">search</span>
            <span className="flex-1 text-start">{t.topbar.search}</span>
            <kbd className="hidden md:inline-flex items-center rounded border border-[#d4d4d8] bg-white px-1.5 py-0.5 text-[10px] font-mono text-[#74777f]">/</kbd>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <button
            onClick={toggleLang}
            className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-[#43474e] hover:bg-[#f4f3f7] transition-colors border border-[#e3e2e6]"
            title={t.topbar.language}
          >
            <span className="material-symbols-outlined text-[16px] text-[#74777f]">language</span>
            {lang === "en" ? "العربية" : "English"}
          </button>

          <Link
            href="/appointments/new"
            className="hidden md:flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            {t.topbar.newAppointment}
          </Link>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setNotifOpen((v) => !v); setUserMenuOpen(false); }}
              className="p-2 hover:bg-[#f4f3f7] rounded-full transition-colors relative"
              aria-label={t.topbar.notifications}
            >
              <span className="material-symbols-outlined text-[#43474e]">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute top-1 end-1 min-w-[16px] h-4 px-0.5 bg-[#ba1a1a] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute end-0 top-full mt-2 w-80 bg-white rounded-xl border border-[#e3e2e6] shadow-[0_8px_32px_rgba(26,54,93,0.15)] z-50">
                <div className="p-4 border-b border-[#e3e2e6] flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-[#1a1c1e]">{t.topbar.notifications}</h3>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs text-[#1960a3] hover:underline">
                      {t.topbar.markAllRead}
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-[#e3e2e6]">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#74777f]">
                      <span className="material-symbols-outlined text-[32px] text-[#c4c6cf] block mb-2">notifications_off</span>
                      {t.topbar.noNotifications}
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <NotifItem
                        key={n.id}
                        icon={n.icon}
                        iconColor={ICON_COLOR_MAP[n.iconColor] ?? "text-[#74777f]"}
                        title={resolveTitle(n)}
                        msg={resolveMsg(n)}
                        time={timeAgo(n.createdAt, t.topbar)}
                        unread={n.unread && !readIds.has(n.id)}
                        link={n.link}
                        onRead={() => { setReadIds((s) => new Set(s).add(n.id)); setNotifOpen(false); router.push(sanitizeLink(n.link)); }}
                      />
                    ))
                  )}
                </div>
                <div className="p-3 text-center border-t border-[#e3e2e6]">
                  <button
                    onClick={() => { setNotifOpen(false); router.push("/audit"); }}
                    className="text-xs text-[#1960a3] hover:underline font-semibold"
                  >
                    {t.topbar.viewAll}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="h-8 w-px bg-[#e3e2e6] mx-1"></div>

          {/* User menu */}
          <div className="relative" ref={userRef}>
            <button
              onClick={() => { setUserMenuOpen((v) => !v); setNotifOpen(false); }}
              className="flex items-center gap-2 hover:bg-[#f4f3f7] rounded-lg px-2 py-1.5 transition-colors"
              aria-label={t.topbar.openUserMenu}
              aria-expanded={userMenuOpen}
            >
              <div className="text-end hidden sm:block">
                <p className="text-xs font-semibold text-[#1a1c1e]">{displayName}</p>
                <p className="text-[11px] text-[#74777f]">{displayRole}</p>
              </div>
              {user?.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.photo} alt={displayName} width={36} height={36} className="w-9 h-9 rounded-full border-2 border-[#d6e3ff] object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#1a365d] text-white flex items-center justify-center text-sm font-bold">
                  {getInitials(displayName)}
                </div>
              )}
              <span className="material-symbols-outlined text-[16px] text-[#74777f]">expand_more</span>
            </button>

            {userMenuOpen && (
              <div className="absolute end-0 top-full mt-2 w-52 bg-white rounded-xl border border-[#e3e2e6] shadow-[0_8px_32px_rgba(26,54,93,0.15)] z-50 py-1">
                <div className="px-4 py-3 border-b border-[#e3e2e6]">
                  <p className="text-sm font-semibold text-[#1a1c1e]">{displayName}</p>
                  <p className="text-xs text-[#74777f]">{displayRole}</p>
                </div>
                <button
                  onClick={toggleLang}
                  className="md:hidden w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#43474e] hover:bg-[#f4f3f7] transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#74777f]">language</span>
                  {lang === "en" ? "العربية" : "English"}
                </button>
                <Link
                  href="/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#43474e] hover:bg-[#f4f3f7] transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#74777f]">settings</span>
                  {t.topbar.settings}
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#ba1a1a] hover:bg-[#ffdad6]/40 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  {t.topbar.signOut}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </>
  );
}

function NotifItem({ icon, iconColor, title, msg, time, unread, onRead }: {
  icon: string; iconColor: string; title: string; msg: string; time: string;
  unread: boolean; link: string; onRead: () => void;
}) {
  return (
    <div onClick={onRead} className={`p-3 flex gap-3 hover:bg-[#f4f3f7] cursor-pointer ${unread ? "bg-[#d3e4ff]/10" : ""}`}>
      <span className={`material-symbols-outlined text-[20px] ${iconColor} mt-0.5 flex-shrink-0`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[#1a1c1e] truncate">{title}</p>
          {unread && <span className="w-2 h-2 rounded-full bg-[#1960a3] flex-shrink-0"></span>}
        </div>
        <p className="text-xs text-[#43474e] truncate">{msg}</p>
        <p className="text-[10px] text-[#74777f] mt-0.5">{time}</p>
      </div>
    </div>
  );
}
