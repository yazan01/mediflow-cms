"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { cn, getInitials } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const NAV_REQUIRED_ROLES: Record<string, string[] | null> = {
  "/":            null,
  "/patients":    null,
  "/appointments":null,
  "/emr":         null,
  "/my-hr":       null,
  "/billing":     ["ACCOUNTANT", "SUPER_ADMIN", "CLINIC_MANAGER", "RECEPTIONIST"],
  "/pharmacy":    ["PHARMACIST", "SUPER_ADMIN", "CLINIC_MANAGER", "DOCTOR", "NURSE", "RECEPTIONIST"],
  "/laboratory":  ["LAB_TECHNICIAN", "SUPER_ADMIN", "CLINIC_MANAGER", "DOCTOR", "NURSE"],
  "/radiology":   ["RADIOLOGIST", "SUPER_ADMIN", "CLINIC_MANAGER", "DOCTOR", "NURSE"],
  "/hr":          ["HR_OFFICER", "SUPER_ADMIN", "CLINIC_MANAGER"],
  "/accounting":  ["ACCOUNTANT", "SUPER_ADMIN", "CLINIC_MANAGER"],
  "/reports":     ["ACCOUNTANT", "SUPER_ADMIN", "CLINIC_MANAGER", "AUDITOR", "DOCTOR"],
  "/users":       ["SUPER_ADMIN", "CLINIC_MANAGER"],
  "/settings":    ["SUPER_ADMIN", "CLINIC_MANAGER"],
  "/audit":       ["SUPER_ADMIN", "CLINIC_MANAGER", "AUDITOR"],
};

interface SidebarProps {
  user?: { name: string; role: string; photo?: string };
  roles?: string[];
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const lv = {
  visible: { opacity: 1, x: 0, width: "auto"    },
  hidden:  { opacity: 0, x: -4, width: 0         },
};

export default function Sidebar({
  user, roles = [], isOpen = false, onClose,
  isCollapsed = false, onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const { t, dir } = useLanguage();
  const displayName = user?.name ?? "User";
  const displayRole = user?.role ?? "Staff";

  const allNavItems = [
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

  const navItems = allNavItems.filter(({ href }) => {
    const required = NAV_REQUIRED_ROLES[href];
    if (!required) return true;
    return roles.some((r) => required.includes(r));
  });

  const canAccessSettings = !NAV_REQUIRED_ROLES["/settings"] ||
    roles.some((r) => NAV_REQUIRED_ROLES["/settings"]!.includes(r));
  const canAccessAudit = !NAV_REQUIRED_ROLES["/audit"] ||
    roles.some((r) => NAV_REQUIRED_ROLES["/audit"]!.includes(r));

  const closedTranslate = dir === "rtl" ? "translate-x-full" : "-translate-x-full";

  const collapseIcon = dir === "rtl"
    ? (isCollapsed ? "chevron_left"  : "chevron_right")
    : (isCollapsed ? "chevron_right" : "chevron_left");

  return (
    <aside
      className={cn(
        "flex flex-col h-screen py-3 flex-shrink-0 overflow-hidden",
        "bg-[var(--bg)] border-e border-[var(--border)]",
        "fixed top-0 start-0 z-50 w-64",
        "md:sticky md:translate-x-0 print:hidden",
        "transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : closedTranslate,
        "md:transition-[width,transform] md:duration-300 md:ease-in-out",
        isCollapsed ? "md:w-[72px]" : "md:w-64",
      )}
      aria-label={t.nav.navigation}
    >
      {/* Mobile close */}
      {onClose && (
        <button
          onClick={onClose}
          className="md:hidden absolute top-3 end-3 p-1.5 rounded-lg hover:bg-[var(--surface2)] text-[var(--txt3)] transition-colors"
          aria-label={t.nav.closeMenu}
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
        </button>
      )}

      {/* Brand + collapse toggle */}
      <div className={cn(
        "mb-4 px-3 pt-1 flex items-center",
        isCollapsed ? "justify-center" : "justify-between gap-2",
      )}>
        <Link href="/" className={cn("flex items-center gap-2.5 min-w-0 group flex-1 overflow-hidden", isCollapsed && "flex-none justify-center")}>
          <div className="w-8 h-8 bg-[#002045] rounded-lg flex items-center justify-center flex-shrink-0 group-hover:opacity-85 transition-opacity">
            <span className="material-symbols-outlined text-white text-[16px]">local_hospital</span>
          </div>
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                key="brand-text"
                initial="hidden" animate="visible" exit="hidden"
                variants={lv} transition={{ duration: 0.18, ease: "easeOut" }}
                className="min-w-0 overflow-hidden"
              >
                <p className="font-bold text-[15px] text-[#002045] leading-tight whitespace-nowrap">
                  {t.nav.brandName}
                </p>
                <p className="text-[10px] text-[var(--txt3)] whitespace-nowrap">
                  {t.nav.brandTagline}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex items-center justify-center w-7 h-7 flex-shrink-0 rounded-lg text-[var(--txt3)] hover:bg-[var(--surface2)] hover:text-[var(--txt1)] transition-all duration-150"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className="material-symbols-outlined text-[18px]">{collapseIcon}</span>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-lg text-sm transition-all duration-150 group relative",
                isCollapsed ? "justify-center py-2.5 mx-0.5" : "gap-3 px-3 py-2.5",
                isActive
                  ? "bg-[#d3e4ff]/40 text-[#1960a3] font-semibold"
                  : "text-[var(--txt2)] hover:bg-[var(--surface2)] hover:text-[var(--txt1)]",
              )}
            >
              {isCollapsed && isActive && (
                <span
                  className="absolute start-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-[#1960a3] rounded-e-full"
                  aria-hidden="true"
                />
              )}
              <span
                className={cn(
                  "material-symbols-outlined text-[20px] flex-shrink-0 transition-colors",
                  isActive ? "text-[#1960a3]" : "text-[var(--txt3)] group-hover:text-[var(--txt2)]",
                )}
              >
                {item.icon}
              </span>
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.span
                    key="lbl"
                    initial="hidden" animate="visible" exit="hidden"
                    variants={lv} transition={{ duration: 0.18, ease: "easeOut" }}
                    className="truncate overflow-hidden whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* Bottom links */}
      <div className="pt-2 border-t border-[var(--border)] px-2 space-y-0.5">
        {canAccessSettings && (
          <Link
            href="/settings"
            title={isCollapsed ? t.nav.settings : undefined}
            className={cn(
              "flex items-center rounded-lg text-sm transition-all duration-150 group",
              "text-[var(--txt2)] hover:bg-[var(--surface2)] hover:text-[var(--txt1)]",
              isCollapsed ? "justify-center py-2.5 mx-0.5" : "gap-3 px-3 py-2.5",
            )}
          >
            <span className="material-symbols-outlined text-[20px] text-[var(--txt3)] group-hover:text-[var(--txt2)] flex-shrink-0">settings</span>
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.span key="s-lbl" initial="hidden" animate="visible" exit="hidden" variants={lv} transition={{ duration: 0.18 }} className="overflow-hidden whitespace-nowrap">
                  {t.nav.settings}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        )}
        {canAccessAudit && (
          <Link
            href="/audit"
            title={isCollapsed ? t.nav.audit : undefined}
            className={cn(
              "flex items-center rounded-lg text-sm transition-all duration-150 group",
              "text-[var(--txt2)] hover:bg-[var(--surface2)] hover:text-[var(--txt1)]",
              isCollapsed ? "justify-center py-2.5 mx-0.5" : "gap-3 px-3 py-2.5",
            )}
          >
            <span className="material-symbols-outlined text-[20px] text-[var(--txt3)] group-hover:text-[var(--txt2)] flex-shrink-0">admin_panel_settings</span>
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.span key="a-lbl" initial="hidden" animate="visible" exit="hidden" variants={lv} transition={{ duration: 0.18 }} className="overflow-hidden whitespace-nowrap">
                  {t.nav.audit}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        )}
      </div>

      {/* User profile */}
      <div className="mt-2 pt-2 border-t border-[var(--border)] px-2">
        <div
          title={isCollapsed ? `${displayName} · ${displayRole}` : undefined}
          className={cn(
            "flex items-center rounded-xl hover:bg-[var(--surface2)] transition-colors cursor-pointer py-2",
            isCollapsed ? "justify-center mx-0.5" : "gap-3 px-2",
          )}
        >
          <div className="w-8 h-8 rounded-full bg-[#1a365d] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
            {getInitials(displayName)}
          </div>
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                key="user-info"
                initial="hidden" animate="visible" exit="hidden"
                variants={lv} transition={{ duration: 0.18, ease: "easeOut" }}
                className="flex-1 min-w-0 overflow-hidden"
              >
                <p className="text-sm font-semibold text-[var(--txt1)] truncate whitespace-nowrap">{displayName}</p>
                <p className="text-xs text-[var(--txt3)] truncate whitespace-nowrap">{displayRole}</p>
              </motion.div>
            )}
          </AnimatePresence>
          {!isCollapsed && (
            <span className="material-symbols-outlined text-[18px] text-[var(--txt3)] flex-shrink-0">more_vert</span>
          )}
        </div>
      </div>
    </aside>
  );
}
