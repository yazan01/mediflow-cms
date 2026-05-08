"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, getInitials } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface SidebarProps {
  user?: { name: string; role: string; photo?: string };
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ user, isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { t, dir } = useLanguage();
  const displayName = user?.name ?? "User";
  const displayRole = user?.role ?? "Staff";

  const navItems = [
    { label: t.nav.dashboard,    href: "/",            icon: "dashboard" },
    { label: t.nav.patients,     href: "/patients",    icon: "person" },
    { label: t.nav.appointments, href: "/appointments",icon: "calendar_today" },
    { label: t.nav.emr,          href: "/emr",         icon: "clinical_notes" },
    { label: t.nav.billing,      href: "/billing",     icon: "payments" },
    { label: t.nav.pharmacy,     href: "/pharmacy",    icon: "medication" },
    { label: t.nav.laboratory,   href: "/laboratory",  icon: "biotech" },
    { label: t.nav.radiology,    href: "/radiology",   icon: "image_search" },
    { label: t.nav.hr,           href: "/hr",          icon: "badge" },
    { label: t.nav.myHr,         href: "/my-hr",       icon: "person_pin" },
    { label: t.nav.accounting,   href: "/accounting",  icon: "account_balance" },
    { label: t.nav.reports,      href: "/reports",     icon: "bar_chart" },
    { label: t.nav.users,        href: "/users",       icon: "manage_accounts" },
  ];

  const closedTranslate = dir === "rtl" ? "translate-x-full" : "-translate-x-full";

  return (
    <aside
      className={cn(
        "flex flex-col h-screen w-64 border-e border-[#e3e2e6] bg-[#faf9fd] py-4 px-4 flex-shrink-0",
        "fixed top-0 start-0 z-50 transition-transform duration-300 ease-in-out",
        "md:sticky md:translate-x-0",
        isOpen ? "translate-x-0" : closedTranslate,
      )}
      aria-label={t.nav.navigation}
    >
      {/* Mobile close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="md:hidden absolute top-3 end-3 p-1.5 rounded-lg hover:bg-[#f4f3f7] text-[#74777f] transition-colors"
          aria-label={t.nav.closeMenu}
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
        </button>
      )}

      {/* Brand */}
      <div className="mb-6 px-2 pt-2">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 bg-[#002045] rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-white text-sm">local_hospital</span>
          </div>
          <h1 className="font-bold text-xl text-[#002045]">{t.nav.brandName}</h1>
        </div>
        <p className="text-xs text-[#74777f] ps-10">{t.nav.brandTagline}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto no-scrollbar">
        {navItems.map((item) => {
          const isActive = item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group",
                isActive
                  ? "bg-[#e9e7eb] text-[#1960a3] font-semibold"
                  : "text-[#43474e] hover:bg-[#f4f3f7] hover:text-[#1a1c1e]"
              )}
            >
              <span
                className={cn(
                  "material-symbols-outlined text-[20px] transition-colors",
                  isActive ? "text-[#1960a3]" : "text-[#74777f] group-hover:text-[#43474e]"
                )}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Settings + Audit Logs */}
      <div className="pt-3 border-t border-[#e3e2e6] space-y-0.5">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#43474e] hover:bg-[#f4f3f7] hover:text-[#1a1c1e] transition-all duration-150"
        >
          <span className="material-symbols-outlined text-[20px] text-[#74777f]">settings</span>
          <span>{t.nav.settings}</span>
        </Link>
        <Link
          href="/audit"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#43474e] hover:bg-[#f4f3f7] hover:text-[#1a1c1e] transition-all duration-150"
        >
          <span className="material-symbols-outlined text-[20px] text-[#74777f]">admin_panel_settings</span>
          <span>{t.nav.audit}</span>
        </Link>
      </div>

      {/* User profile */}
      <div className="mt-3 pt-3 border-t border-[#e3e2e6]">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[#f4f3f7] transition-colors cursor-pointer">
          <div className="w-9 h-9 rounded-full bg-[#1a365d] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
            {getInitials(displayName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#1a1c1e] truncate">{displayName}</p>
            <p className="text-xs text-[#74777f] truncate">{displayRole}</p>
          </div>
          <span className="material-symbols-outlined text-[18px] text-[#74777f]">more_vert</span>
        </div>
      </div>
    </aside>
  );
}
