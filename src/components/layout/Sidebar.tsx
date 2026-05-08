"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { cn, getInitials } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const NAV_REQUIRED_ROLES: Record<string, string[] | null> = {
  "/":             null,
  "/patients":     null,
  "/appointments": null,
  "/emr":          null,
  "/my-hr":        null,
  "/billing":      ["ACCOUNTANT", "SUPER_ADMIN", "CLINIC_MANAGER", "RECEPTIONIST"],
  "/pharmacy":     ["PHARMACIST", "SUPER_ADMIN", "CLINIC_MANAGER", "DOCTOR", "NURSE", "RECEPTIONIST"],
  "/laboratory":   ["LAB_TECHNICIAN", "SUPER_ADMIN", "CLINIC_MANAGER", "DOCTOR", "NURSE"],
  "/radiology":    ["RADIOLOGIST", "SUPER_ADMIN", "CLINIC_MANAGER", "DOCTOR", "NURSE"],
  "/hr":           ["HR_OFFICER", "SUPER_ADMIN", "CLINIC_MANAGER"],
  "/accounting":   ["ACCOUNTANT", "SUPER_ADMIN", "CLINIC_MANAGER"],
  "/reports":      ["ACCOUNTANT", "SUPER_ADMIN", "CLINIC_MANAGER", "AUDITOR", "DOCTOR"],
  "/users":        ["SUPER_ADMIN", "CLINIC_MANAGER"],
  "/settings":     ["SUPER_ADMIN", "CLINIC_MANAGER"],
  "/audit":        ["SUPER_ADMIN", "CLINIC_MANAGER", "AUDITOR"],
};

interface NavItemDef {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}

interface SidebarProps {
  user?: { name: string; role: string; photo?: string };
  roles?: string[];
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  apptBadge?: number;
  billingBadge?: number;
}

const lv = {
  visible: { opacity: 1, x: 0, width: "auto" },
  hidden:  { opacity: 0, x: -4, width: 0 },
};

function filterByRole(items: NavItemDef[], roles: string[]): NavItemDef[] {
  return items.filter(({ href }) => {
    const req = NAV_REQUIRED_ROLES[href];
    return !req || roles.some((r) => req.includes(r));
  });
}

export default function Sidebar({
  user, roles = [], isOpen = false, onClose,
  isCollapsed = false, onToggleCollapse,
  apptBadge, billingBadge,
}: SidebarProps) {
  const pathname = usePathname();
  const { t, dir } = useLanguage();
  const displayName = user?.name ?? "User";
  const displayRole = user?.role ?? "Staff";
  const isRtl = dir === "rtl";

  const primaryItems = filterByRole([
    { label: t.nav.dashboard,    href: "/",            icon: "space_dashboard" },
    { label: t.nav.patients,     href: "/patients",    icon: "groups" },
    { label: t.nav.appointments, href: "/appointments",icon: "event", badge: apptBadge },
    { label: t.nav.emr,          href: "/emr",         icon: "stethoscope" },
  ], roles);

  const opsItems = filterByRole([
    { label: t.nav.billing,    href: "/billing",    icon: "receipt_long", badge: billingBadge },
    { label: t.nav.pharmacy,   href: "/pharmacy",   icon: "pill" },
    { label: t.nav.laboratory, href: "/laboratory", icon: "labs" },
    { label: t.nav.radiology,  href: "/radiology",  icon: "radiology" },
  ], roles);

  const adminItems = filterByRole([
    { label: t.nav.hr,         href: "/hr",         icon: "badge" },
    { label: t.nav.accounting, href: "/accounting", icon: "account_balance" },
    { label: t.nav.reports,    href: "/reports",    icon: "monitoring" },
    { label: t.nav.users,      href: "/users",      icon: "manage_accounts" },
  ], roles);

  const canAccessSettings = !NAV_REQUIRED_ROLES["/settings"] ||
    roles.some((r) => NAV_REQUIRED_ROLES["/settings"]!.includes(r));
  const canAccessAudit = !NAV_REQUIRED_ROLES["/audit"] ||
    roles.some((r) => NAV_REQUIRED_ROLES["/audit"]!.includes(r));

  const closedTranslate = isRtl ? "translate-x-full" : "-translate-x-full";
  const collapseIcon = isRtl
    ? (isCollapsed ? "chevron_left"  : "chevron_right")
    : (isCollapsed ? "chevron_right" : "chevron_left");

  function NavItem({ item }: { item: NavItemDef }) {
    const isActive = item.href === "/"
      ? pathname === "/"
      : pathname === item.href || pathname.startsWith(item.href + "/");

    return (
      <Link
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        title={isCollapsed ? item.label : undefined}
        className={cn(
          "flex items-center rounded-[10px] text-[13.5px] font-medium transition-all duration-150 group relative",
          "my-0.5",
          isCollapsed ? "justify-center p-[10px] mx-0.5" : "gap-3 px-2.5 py-2",
          isActive
            ? "bg-[var(--brand-soft)] text-[var(--brand)] font-semibold"
            : "text-[var(--t2)] hover:bg-[var(--hover)] hover:text-[var(--t1)]",
        )}
      >
        {isCollapsed && isActive && (
          <span
            className="absolute start-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-[var(--brand)] rounded-e-full"
            aria-hidden="true"
          />
        )}
        <span
          className="material-symbols-outlined text-[20px] flex-shrink-0 transition-colors"
          style={{
            fontVariationSettings: isActive
              ? `'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24`
              : `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
            color: isActive ? "var(--brand)" : "var(--t3)",
          }}
        >
          {item.icon}
        </span>
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.span
              key="lbl"
              initial="hidden" animate="visible" exit="hidden"
              variants={lv} transition={{ duration: 0.18, ease: "easeOut" }}
              className="flex-1 truncate overflow-hidden whitespace-nowrap"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>
        {!isCollapsed && item.badge != null && item.badge > 0 && (
          <span
            className="text-[10.5px] font-bold tabular px-1.5 py-px rounded-full min-w-[18px] text-center flex-shrink-0"
            style={{
              background: item.href === "/billing" ? "var(--err-soft)" : "var(--teal-soft)",
              color:      item.href === "/billing" ? "var(--err)"      : "var(--teal-h)",
            }}
          >
            {item.badge}
          </span>
        )}
      </Link>
    );
  }

  function NavGroup({ title, items }: { title?: string; items: NavItemDef[] }) {
    if (items.length === 0) return null;
    return (
      <div className="mb-3">
        {!isCollapsed && title && (
          <div
            className="text-[10px] font-semibold tracking-[0.1em] px-2.5 py-2"
            style={{ color: "var(--t4)" }}
          >
            {title}
          </div>
        )}
        <div>
          {items.map((item) => <NavItem key={item.href} item={item} />)}
        </div>
      </div>
    );
  }

  const opsLabel  = isRtl ? "العمليات" : "OPERATIONS";
  const adminLabel = isRtl ? "الإدارة"  : "ADMIN";

  return (
    <aside
      className={cn(
        "flex flex-col h-screen flex-shrink-0 overflow-hidden",
        "bg-[var(--surface)] border-e border-[var(--border)]",
        "fixed top-0 start-0 z-50 w-64",
        "md:sticky md:translate-x-0 print:hidden",
        "transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : closedTranslate,
        "md:transition-[width,transform] md:duration-300 md:ease-in-out",
        isCollapsed ? "md:w-[72px]" : "md:w-[264px]",
      )}
      aria-label={t.nav.navigation}
    >
      {/* Mobile close */}
      {onClose && (
        <button
          onClick={onClose}
          className="md:hidden absolute top-3 end-3 p-1.5 rounded-lg hover:bg-[var(--hover)] text-[var(--t3)] transition-colors"
          aria-label={t.nav.closeMenu}
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
        </button>
      )}

      {/* Brand */}
      <div className={cn(
        "flex items-center gap-2.5 flex-shrink-0 py-[18px]",
        isCollapsed ? "justify-center px-3" : "px-4 justify-between",
      )}>
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2.5 min-w-0 group overflow-hidden flex-1",
            isCollapsed && "flex-none justify-center",
          )}
        >
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 transition-opacity group-hover:opacity-85"
            style={{
              background: "linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%)",
              boxShadow: "var(--sh-2), inset 0 1px 0 rgba(255,255,255,0.16)",
            }}
          >
            <span
              className="material-symbols-outlined text-white text-[20px]"
              style={{ fontVariationSettings: `'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24` }}
            >
              health_and_safety
            </span>
          </div>
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                key="brand-text"
                initial="hidden" animate="visible" exit="hidden"
                variants={lv} transition={{ duration: 0.18, ease: "easeOut" }}
                className="min-w-0 overflow-hidden"
              >
                <p className="font-bold text-[15px] text-[var(--t1)] leading-tight whitespace-nowrap tracking-[-0.015em]">
                  {t.nav.brandName}
                </p>
                <p className="text-[10.5px] text-[var(--t3)] whitespace-nowrap font-medium tracking-[0.02em]">
                  {t.nav.brandTagline}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={cn(
              "hidden md:flex items-center justify-center w-7 h-7 flex-shrink-0 rounded-lg",
              "text-[var(--t3)] hover:bg-[var(--hover)] hover:text-[var(--t1)] transition-all duration-150",
              isCollapsed && "mt-0",
            )}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className="material-symbols-outlined text-[16px]">{collapseIcon}</span>
          </button>
        )}
      </div>

      {/* Quick search (expanded only) */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            key="search"
            initial="hidden" animate="visible" exit="hidden"
            variants={lv} transition={{ duration: 0.18, ease: "easeOut" }}
            className="px-3 pb-2.5 overflow-hidden flex-shrink-0"
          >
            <div
              className="h-9 flex items-center gap-2 px-2.5 rounded-[10px] border border-[var(--border)] cursor-text hover:border-[var(--border-2)] transition-colors"
              style={{ background: "var(--surface-2)" }}
            >
              <span className="material-symbols-outlined text-[16px] text-[var(--t3)] flex-shrink-0">search</span>
              <span className="text-[12.5px] text-[var(--t3)] flex-1">
                {isRtl ? "بحث سريع…" : "Quick search…"}
              </span>
              <kbd
                className="font-mono text-[10px] text-[var(--t3)] rounded px-1 py-0.5 flex-shrink-0"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                ⌘K
              </kbd>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-2.5 pt-1">
        <NavGroup items={primaryItems} />
        <NavGroup title={opsLabel}   items={opsItems} />
        <NavGroup title={adminLabel} items={adminItems} />
      </nav>

      {/* Bottom links */}
      <div className="border-t border-[var(--border)] px-2.5 py-1.5 flex-shrink-0">
        {canAccessSettings && (
          <Link
            href="/settings"
            title={isCollapsed ? t.nav.settings : undefined}
            className={cn(
              "flex items-center rounded-[10px] text-[13.5px] font-medium transition-all duration-150 my-0.5",
              "text-[var(--t2)] hover:bg-[var(--hover)] hover:text-[var(--t1)]",
              isCollapsed ? "justify-center p-[10px] mx-0.5" : "gap-3 px-2.5 py-2",
            )}
          >
            <span className="material-symbols-outlined text-[20px] text-[var(--t3)] flex-shrink-0">settings</span>
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
              "flex items-center rounded-[10px] text-[13.5px] font-medium transition-all duration-150 my-0.5",
              "text-[var(--t2)] hover:bg-[var(--hover)] hover:text-[var(--t1)]",
              isCollapsed ? "justify-center p-[10px] mx-0.5" : "gap-3 px-2.5 py-2",
            )}
          >
            <span className="material-symbols-outlined text-[20px] text-[var(--t3)] flex-shrink-0">admin_panel_settings</span>
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
      <div className="border-t border-[var(--border)] px-2 pt-2 pb-3 flex-shrink-0">
        <div
          title={isCollapsed ? `${displayName} · ${displayRole}` : undefined}
          className={cn(
            "flex items-center transition-colors cursor-pointer",
            isCollapsed ? "justify-center p-2 mx-0.5 rounded-xl hover:bg-[var(--hover)]" : "gap-3",
          )}
          style={!isCollapsed ? {
            padding: "10px",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 12,
          } : {}}
        >
          <div
            className="w-9 h-9 rounded-full text-white flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: `linear-gradient(135deg, var(--brand), var(--brand-2))` }}
          >
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
                <p className="text-[13px] font-semibold text-[var(--t1)] truncate whitespace-nowrap">{displayName}</p>
                <p className="text-[11px] text-[var(--t3)] truncate whitespace-nowrap">{displayRole}</p>
              </motion.div>
            )}
          </AnimatePresence>
          {!isCollapsed && (
            <span className="material-symbols-outlined text-[18px] text-[var(--t3)] flex-shrink-0">more_horiz</span>
          )}
        </div>
      </div>
    </aside>
  );
}
