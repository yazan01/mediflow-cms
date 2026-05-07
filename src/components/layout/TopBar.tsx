"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getInitials } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface TopBarProps {
  user?: { name: string; role: string; photo?: string };
}

export default function TopBar({ user }: TopBarProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { t, lang, setLang } = useLanguage();

  const notifications = [
    { icon: "warning",   iconColor: "text-[#d97706]", title: t.topbar.lowStock,     msg: t.topbar.lowStockMsg,     time: "5 min ago",   unread: true },
    { icon: "emergency", iconColor: "text-[#ba1a1a]", title: t.topbar.urgentAppt,   msg: t.topbar.urgentApptMsg,   time: "12 min ago",  unread: true },
    { icon: "biotech",   iconColor: "text-[#1960a3]", title: t.topbar.labResults,   msg: t.topbar.labResultsMsg,   time: "1 hour ago",  unread: false },
    { icon: "payments",  iconColor: "text-[#ba1a1a]", title: t.topbar.overdueInvoice, msg: t.topbar.overdueInvoiceMsg, time: "2 hours ago", unread: false },
  ];
  const unreadCount = notifications.filter((n) => n.unread).length;

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

  return (
    <header className="flex justify-between items-center w-full h-16 px-6 sticky top-0 z-40 bg-[#faf9fd] border-b border-[#e3e2e6]">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-full max-w-md">
          <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[#74777f] text-[18px]">search</span>
          <input
            className="w-full bg-[#f4f3f7] border-none rounded-full py-2 ps-10 pe-4 text-sm text-[#1a1c1e] placeholder:text-[#74777f] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20"
            placeholder={t.topbar.search}
            type="text"
          />
        </div>
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
            {unreadCount > 0 && <span className="absolute top-1.5 end-1.5 w-2 h-2 bg-[#ba1a1a] rounded-full"></span>}
          </button>

          {notifOpen && (
            <div className="absolute end-0 top-full mt-2 w-80 bg-white rounded-xl border border-[#e3e2e6] shadow-[0_8px_32px_rgba(26,54,93,0.15)] z-50">
              <div className="p-4 border-b border-[#e3e2e6] flex items-center justify-between">
                <h3 className="font-semibold text-sm text-[#1a1c1e]">{t.topbar.notifications}</h3>
                <button className="text-xs text-[#1960a3] hover:underline">{t.topbar.markAllRead}</button>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-[#e3e2e6]">
                {notifications.map((n, i) => (
                  <NotifItem key={i} icon={n.icon} iconColor={n.iconColor} title={n.title} msg={n.msg} time={n.time} unread={n.unread} />
                ))}
              </div>
              <div className="p-3 text-center border-t border-[#e3e2e6]">
                <button className="text-xs text-[#1960a3] hover:underline font-semibold">{t.topbar.viewAll}</button>
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
              {/* Language toggle inside menu for mobile */}
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
  );
}

function NotifItem({ icon, iconColor, title, msg, time, unread }: {
  icon: string; iconColor: string; title: string; msg: string; time: string; unread: boolean;
}) {
  return (
    <div className={`p-3 flex gap-3 hover:bg-[#f4f3f7] cursor-pointer ${unread ? "bg-[#d3e4ff]/10" : ""}`}>
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
