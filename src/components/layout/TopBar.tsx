"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getInitials } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { GlobalSearch } from "@/components/GlobalSearch";

interface TopBarProps {
  user?: { name: string; role: string; photo?: string };
  onMenuClick?: () => void;
  darkMode?: boolean;
  onToggleDark?: () => void;
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

function timeAgo(
  isoStr: string,
  t: { justNow: string; minutesAgo: string; hoursAgo: string; daysAgo: string },
): string {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60)    return t.justNow;
  if (diff < 3600)  return interpolate(t.minutesAgo, { n: Math.floor(diff / 60) });
  if (diff < 86400) return interpolate(t.hoursAgo,   { n: Math.floor(diff / 3600) });
  return interpolate(t.daysAgo, { n: Math.floor(diff / 86400) });
}

const popAnim = {
  hidden:  { opacity: 0, scale: 0.94, y: -6 },
  visible: { opacity: 1, scale: 1,    y: 0,  transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  exit:    { opacity: 0, scale: 0.94, y: -4, transition: { duration: 0.12, ease: "easeIn" as const } },
};

export default function TopBar({ user, onMenuClick, darkMode = false, onToggleDark }: TopBarProps) {
  const [notifOpen,    setNotifOpen]    = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen,   setSearchOpen]   = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef  = useRef<HTMLDivElement>(null);
  const router   = useRouter();
  const { t, lang, setLang } = useLanguage();

  const [notifications, setNotifications] = useState<ApiNotif[]>([]);
  const [readIds, setReadIds]             = useState<Set<string>>(new Set());
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
    const id = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === "/" && target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
        e.preventDefault(); setSearchOpen(true);
      }
      if (e.key === "Escape") { setNotifOpen(false); setUserMenuOpen(false); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (userRef.current  && !userRef.current.contains(e.target as Node))  setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function markAllRead() {
    setReadIds(new Set(notifications.map((n) => n.id)));
  }

  const displayName = user?.name ?? "User";
  const displayRole = user?.role ?? "Staff";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function toggleLang() { setLang(lang === "en" ? "ar" : "en"); }

  function sanitizeLink(link: string): string {
    try {
      const url = new URL(link, window.location.href);
      if (url.protocol === "javascript:") return "/";
      return link;
    } catch { return "/"; }
  }

  function resolveTitle(n: ApiNotif): string {
    const key  = n.title as keyof typeof t.topbar;
    const base = (t.topbar[key] as string) ?? n.title;
    return n.titleData ? `${base}: ${n.titleData}` : base;
  }

  function resolveMsg(n: ApiNotif): string {
    const key      = n.message as keyof typeof t.topbar;
    const template = (t.topbar[key] as string) ?? n.message;
    return interpolate(template, n.messageData);
  }

  return (
    <>
      <header
        className="flex justify-between items-center w-full h-16 px-5 sticky top-0 z-40 border-b print:hidden transition-all duration-300"
        style={{
          background: "color-mix(in srgb, var(--surface) 88%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderColor: "var(--border)",
        }}
      >
        {/* Left: hamburger + search */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="md:hidden btn-icon flex-shrink-0"
              aria-label={t.topbar.openMenu}
            >
              <span className="material-symbols-outlined" style={{ color: "var(--txt2)" }} aria-hidden="true">menu</span>
            </button>
          )}

          {/* Search trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2.5 max-w-xs w-full px-3 text-sm transition-all duration-150 rounded-xl"
            style={{
              height: 38,
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              color: "var(--txt4)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border2)";
              (e.currentTarget as HTMLButtonElement).style.background = "var(--surface)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLButtonElement).style.background = "var(--surface2)";
            }}
            aria-label={t.common.searchLabel}
          >
            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: 16 }}>search</span>
            <span className="flex-1 text-start text-[13px]">{t.topbar.search}</span>
            <kbd
              className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono flex-shrink-0 rounded"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--txt4)" }}
            >
              /
            </kbd>
          </button>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Language toggle */}
          <button
            onClick={toggleLang}
            className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-150 border"
            style={{
              color: "var(--txt2)",
              borderColor: "var(--border)",
              background: "transparent",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--hover)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            title={t.topbar.language}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--txt3)" }}>language</span>
            {lang === "en" ? "العربية" : "English"}
          </button>

          {/* Dark mode toggle */}
          {onToggleDark && (
            <button
              onClick={onToggleDark}
              className="btn-icon"
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: "var(--txt2)" }}>
                {darkMode ? "light_mode" : "dark_mode"}
              </span>
            </button>
          )}

          {/* New appointment CTA */}
          <Link
            href="/appointments/new"
            className="hidden md:flex btn-primary btn-sm items-center gap-1.5 ms-1"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
            {t.topbar.newAppointment}
          </Link>

          {/* Divider */}
          <div className="w-px h-6 mx-1" style={{ background: "var(--border)" }} />

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setNotifOpen((v) => !v); setUserMenuOpen(false); }}
              className="btn-icon relative"
              aria-label={t.topbar.notifications}
              aria-expanded={notifOpen}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: "var(--txt2)" }}>notifications</span>
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-1 end-1 min-w-[16px] h-4 px-0.5 text-white text-[9.5px] font-bold rounded-full flex items-center justify-center"
                  style={{ background: "var(--err)" }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </motion.span>
              )}
            </button>

            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  key="notif-panel"
                  variants={popAnim}
                  initial="hidden" animate="visible" exit="exit"
                  className="absolute end-0 top-full mt-2 w-80 z-50 overflow-hidden"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    boxShadow: "var(--sh-pop)",
                  }}
                  role="dialog"
                  aria-label={t.topbar.notifications}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm" style={{ color: "var(--txt1)" }}>{t.topbar.notifications}</span>
                      {unreadCount > 0 && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-px rounded-full"
                          style={{ background: "var(--err)", color: "white" }}
                        >
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-xs font-semibold hover:underline transition-colors"
                        style={{ color: "var(--blue)" }}
                      >
                        {t.topbar.markAllRead}
                      </button>
                    )}
                  </div>

                  {/* List */}
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-10 text-center">
                        <span
                          className="material-symbols-outlined block mx-auto mb-2"
                          style={{ fontSize: 32, color: "var(--txt4)", fontVariationSettings: `'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24` }}
                        >
                          notifications_off
                        </span>
                        <p className="text-xs font-medium" style={{ color: "var(--txt3)" }}>{t.topbar.noNotifications}</p>
                      </div>
                    ) : (
                      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                        {notifications.map((n) => (
                          <NotifItem
                            key={n.id}
                            icon={n.icon}
                            iconColor={ICON_COLOR_MAP[n.iconColor] ?? "text-[var(--txt3)]"}
                            title={resolveTitle(n)}
                            msg={resolveMsg(n)}
                            time={timeAgo(n.createdAt, t.topbar)}
                            unread={n.unread && !readIds.has(n.id)}
                            link={n.link}
                            onRead={() => {
                              setReadIds((s) => new Set(s).add(n.id));
                              setNotifOpen(false);
                              router.push(sanitizeLink(n.link));
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-3 border-t text-center" style={{ borderColor: "var(--border)", background: "var(--surface2)" }}>
                    <button
                      onClick={() => { setNotifOpen(false); router.push("/audit"); }}
                      className="text-xs font-bold hover:underline"
                      style={{ color: "var(--blue)" }}
                    >
                      {t.topbar.viewAll}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User menu */}
          <div className="relative" ref={userRef}>
            <button
              onClick={() => { setUserMenuOpen((v) => !v); setNotifOpen(false); }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all duration-150 ms-1"
              style={{ color: "var(--txt1)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--hover)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              aria-label={t.topbar.openUserMenu}
              aria-expanded={userMenuOpen}
            >
              <div className="hidden sm:block text-end">
                <p className="text-xs font-bold" style={{ color: "var(--txt1)" }}>{displayName}</p>
                <p className="text-[10.5px]" style={{ color: "var(--txt3)" }}>{displayRole}</p>
              </div>
              {user?.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.photo}
                  alt={displayName}
                  width={34} height={34}
                  className="w-[34px] h-[34px] rounded-full object-cover"
                  style={{ border: "2px solid var(--border2)" }}
                />
              ) : (
                <div className="avatar avatar-sm" style={{ width: 34, height: 34, fontSize: 12 }}>
                  {getInitials(displayName)}
                </div>
              )}
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--txt3)" }}>expand_more</span>
            </button>

            <AnimatePresence>
              {userMenuOpen && (
                <motion.div
                  key="user-menu"
                  variants={popAnim}
                  initial="hidden" animate="visible" exit="exit"
                  className="absolute end-0 top-full mt-2 w-52 z-50 overflow-hidden"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 14,
                    boxShadow: "var(--sh-pop)",
                  }}
                >
                  {/* User info header */}
                  <div className="px-4 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center gap-2.5">
                      <div className="avatar avatar-sm" style={{ width: 32, height: 32, fontSize: 11 }}>
                        {getInitials(displayName)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold truncate" style={{ color: "var(--txt1)" }}>{displayName}</p>
                        <p className="text-[11px] truncate" style={{ color: "var(--txt3)" }}>{displayRole}</p>
                      </div>
                    </div>
                  </div>

                  <div className="py-1">
                    {/* Language toggle (mobile) */}
                    <button
                      onClick={toggleLang}
                      className="menu-item md:hidden"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--txt3)" }}>language</span>
                      {lang === "en" ? "العربية" : "English"}
                    </button>

                    {/* Dark mode */}
                    {onToggleDark && (
                      <button onClick={onToggleDark} className="menu-item w-full text-start">
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--txt3)" }}>
                          {darkMode ? "light_mode" : "dark_mode"}
                        </span>
                        {darkMode ? "Light mode" : "Dark mode"}
                        <span
                          className="ms-auto text-[10px] font-bold px-1.5 py-px rounded-full"
                          style={{ background: darkMode ? "var(--amber-soft)" : "var(--surface3)", color: "var(--txt3)" }}
                        >
                          {darkMode ? "ON" : "OFF"}
                        </span>
                      </button>
                    )}

                    {/* Settings */}
                    <Link href="/settings" onClick={() => setUserMenuOpen(false)} className="menu-item">
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--txt3)" }}>settings</span>
                      {t.topbar.settings}
                    </Link>

                    <div className="h-px my-1 mx-3" style={{ background: "var(--border)" }} />

                    {/* Sign out */}
                    <button onClick={handleLogout} className="menu-item danger w-full text-start">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
                      {t.topbar.signOut}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </>
  );
}

function NotifItem({
  icon, iconColor, title, msg, time, unread, onRead,
}: {
  icon: string; iconColor: string; title: string; msg: string;
  time: string; unread: boolean; link: string; onRead: () => void;
}) {
  return (
    <div
      onClick={onRead}
      className="flex gap-3 px-4 py-3 cursor-pointer transition-colors duration-100"
      style={{ background: unread ? "color-mix(in srgb, var(--blue-soft) 25%, transparent)" : "transparent" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--hover)"; }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background =
          unread ? "color-mix(in srgb, var(--blue-soft) 25%, transparent)" : "transparent";
      }}
    >
      <span className={`material-symbols-outlined text-[20px] ${iconColor} mt-0.5 flex-shrink-0`}
        style={{ fontVariationSettings: `'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-semibold truncate" style={{ color: "var(--txt1)" }}>{title}</p>
          {unread && (
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "var(--blue)" }} />
          )}
        </div>
        <p className="text-xs truncate mt-0.5" style={{ color: "var(--txt2)" }}>{msg}</p>
        <p className="text-[10.5px] mt-1 font-medium" style={{ color: "var(--txt4)" }}>{time}</p>
      </div>
    </div>
  );
}
