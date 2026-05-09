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
  visible: { opacity: 1, x: 0, width: "auto", transition: { duration: 0.18, ease: "easeOut" as const } },
  hidden:  { opacity: 0, x: -6, width: 0,    transition: { duration: 0.14, ease: "easeIn"  as const } },
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
  const pathname    = usePathname();
  const { t, dir } = useLanguage();
  const displayName = user?.name ?? "User";
  const displayRole = user?.role ?? "Staff";
  const isRtl       = dir === "rtl";

  const primaryItems = filterByRole([
    { label: t.nav.dashboard,    href: "/",             icon: "space_dashboard" },
    { label: t.nav.patients,     href: "/patients",     icon: "groups"          },
    { label: t.nav.appointments, href: "/appointments", icon: "event", badge: apptBadge },
    { label: t.nav.emr,          href: "/emr",          icon: "stethoscope"     },
  ], roles);

  const opsItems = filterByRole([
    { label: t.nav.billing,    href: "/billing",    icon: "receipt_long", badge: billingBadge },
    { label: t.nav.pharmacy,   href: "/pharmacy",   icon: "pill"          },
    { label: t.nav.laboratory, href: "/laboratory", icon: "labs"          },
    { label: t.nav.radiology,  href: "/radiology",  icon: "radiology"     },
  ], roles);

  const adminItems = filterByRole([
    { label: t.nav.hr,         href: "/hr",         icon: "badge"           },
    { label: t.nav.accounting, href: "/accounting", icon: "account_balance" },
    { label: t.nav.reports,    href: "/reports",    icon: "monitoring"      },
    { label: t.nav.users,      href: "/users",      icon: "manage_accounts" },
  ], roles);

  const canAccessSettings = !NAV_REQUIRED_ROLES["/settings"] ||
    roles.some((r) => NAV_REQUIRED_ROLES["/settings"]!.includes(r));
  const canAccessAudit = !NAV_REQUIRED_ROLES["/audit"] ||
    roles.some((r) => NAV_REQUIRED_ROLES["/audit"]!.includes(r));

  const closedTranslate = isRtl ? "translate-x-full" : "-translate-x-full";
  const collapseIcon    = isRtl
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
          "relative flex items-center rounded-[10px] text-[13px] font-medium transition-all duration-150 group select-none",
          "my-px",
          isCollapsed ? "justify-center p-[11px] mx-1" : "gap-3 px-3 py-2.5",
          isActive
            ? "bg-[var(--brand-soft)] text-[var(--brand)] font-semibold"
            : "text-[var(--txt2)] hover:bg-[var(--hover)] hover:text-[var(--txt1)]",
        )}
      >
        {/* Active indicator bar */}
        {isActive && (
          <motion.span
            layoutId="sidebar-active-bar"
            className="absolute start-0 w-[3px] rounded-e-full"
            style={{
              top: "20%", bottom: "20%",
              background: "var(--brand)",
            }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            aria-hidden="true"
          />
        )}

        {/* Icon */}
        <span
          className="material-symbols-outlined flex-shrink-0 transition-all duration-150"
          style={{
            fontSize: 19,
            fontVariationSettings: isActive
              ? `'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24`
              : `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
            color: isActive ? "var(--brand)" : "var(--txt3)",
          }}
          aria-hidden="true"
        >
          {item.icon}
        </span>

        {/* Label */}
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.span
              key="lbl"
              initial="hidden" animate="visible" exit="hidden"
              variants={lv}
              className="flex-1 truncate overflow-hidden whitespace-nowrap"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Badge */}
        {!isCollapsed && item.badge != null && item.badge > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-[10px] font-bold tabular px-1.5 py-px rounded-full min-w-[18px] text-center flex-shrink-0"
            style={{
              background: item.href === "/billing" ? "var(--err-soft)" : "var(--blue-soft)",
              color:      item.href === "/billing" ? "var(--err)"      : "var(--blue)",
            }}
          >
            {item.badge > 99 ? "99+" : item.badge}
          </motion.span>
        )}

        {/* Collapsed badge dot */}
        {isCollapsed && item.badge != null && item.badge > 0 && (
          <span
            className="absolute top-1 end-1 w-2 h-2 rounded-full border-2 border-[var(--surface)]"
            style={{ background: item.href === "/billing" ? "var(--err)" : "var(--blue)" }}
            aria-hidden="true"
          />
        )}
      </Link>
    );
  }

  function NavGroup({ title, items }: { title?: string; items: NavItemDef[] }) {
    if (items.length === 0) return null;
    return (
      <div className="mb-1">
        <AnimatePresence initial={false}>
          {!isCollapsed && title && (
            <motion.div
              key="group-title"
              initial="hidden" animate="visible" exit="hidden"
              variants={lv}
              className="px-3 py-2 overflow-hidden"
            >
              <p
                className="text-[10px] font-bold tracking-[0.1em] uppercase whitespace-nowrap overflow-hidden"
                style={{ color: "var(--txt4)" }}
              >
                {title}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
        {isCollapsed && title && <div className="h-px mx-3 my-2" style={{ background: "var(--border)" }} />}
        <div>
          {items.map((item) => <NavItem key={item.href} item={item} />)}
        </div>
      </div>
    );
  }

  const opsLabel   = isRtl ? "العمليات" : "OPERATIONS";
  const adminLabel = isRtl ? "الإدارة"  : "ADMIN";

  return (
    <aside
      className={cn(
        "flex flex-col h-screen flex-shrink-0 overflow-hidden",
        "fixed top-0 start-0 z-50 w-64",
        "md:sticky md:translate-x-0 print:hidden",
        "transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : closedTranslate,
        "md:transition-[width,transform] md:duration-300",
        isCollapsed ? "md:w-[72px]" : "md:w-[264px]",
      )}
      style={{ background: "var(--surface)", borderInlineEnd: "1px solid var(--border)" }}
      aria-label={t.nav.navigation}
    >
      {/* Mobile close overlay button */}
      {onClose && (
        <button
          onClick={onClose}
          className="md:hidden absolute top-3 end-3 p-1.5 rounded-lg transition-colors"
          style={{ color: "var(--txt3)" }}
          aria-label={t.nav.closeMenu}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }} aria-hidden="true">close</span>
        </button>
      )}

      {/* ── Brand ─────────────────────────────────── */}
      <div className={cn(
        "flex items-center flex-shrink-0 py-4",
        isCollapsed ? "justify-center px-3" : "px-4 justify-between gap-2",
      )}>
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2.5 min-w-0 group overflow-hidden flex-1",
            isCollapsed && "flex-none justify-center",
          )}
        >
          {/* Logo icon */}
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 transition-all duration-150 group-hover:shadow-md"
            style={{
              background: "linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%)",
              boxShadow: "var(--sh-2), inset 0 1px 0 rgba(255,255,255,0.15)",
            }}
          >
            <span
              className="material-symbols-outlined text-white"
              style={{ fontSize: 19, fontVariationSettings: `'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24` }}
            >
              health_and_safety
            </span>
          </div>

          {/* Brand text */}
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                key="brand-text"
                initial="hidden" animate="visible" exit="hidden"
                variants={lv}
                className="min-w-0 overflow-hidden"
              >
                <p className="font-bold text-[14.5px] leading-tight whitespace-nowrap tracking-[-0.015em]"
                  style={{ color: "var(--txt1)" }}>
                  {t.nav.brandName}
                </p>
                <p className="text-[10.5px] whitespace-nowrap font-medium"
                  style={{ color: "var(--txt4)" }}>
                  {t.nav.brandTagline}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>

        {/* Collapse toggle */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={cn(
              "hidden md:flex items-center justify-center w-7 h-7 flex-shrink-0 rounded-lg transition-all duration-150",
            )}
            style={{ color: "var(--txt4)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--hover)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--txt1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--txt4)";
            }}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{collapseIcon}</span>
          </button>
        )}
      </div>

      {/* ── Quick search (expanded only) ────────── */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            key="search"
            initial="hidden" animate="visible" exit="hidden"
            variants={lv}
            className="px-3 pb-3 overflow-hidden flex-shrink-0"
          >
            <div
              className="h-9 flex items-center gap-2 px-2.5 rounded-[10px] border cursor-text transition-colors duration-150"
              style={{
                background: "var(--surface2)",
                borderColor: "var(--border)",
              }}
              onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border2)"}
              onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"}
            >
              <span className="material-symbols-outlined flex-shrink-0"
                style={{ fontSize: 15, color: "var(--txt4)" }}>
                search
              </span>
              <span className="text-[12px] flex-1" style={{ color: "var(--txt4)" }}>
                {isRtl ? "بحث سريع…" : "Quick search…"}
              </span>
              <kbd
                className="text-[10px] rounded px-1 py-0.5 flex-shrink-0 font-mono"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--txt4)",
                }}
              >
                /
              </kbd>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Navigation ─────────────────────────── */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-2 pt-1 pb-2">
        <NavGroup items={primaryItems} />
        <NavGroup title={opsLabel}   items={opsItems}   />
        <NavGroup title={adminLabel} items={adminItems} />
      </nav>

      {/* ── Bottom links ───────────────────────── */}
      <div className="flex-shrink-0 px-2 py-1.5" style={{ borderTop: "1px solid var(--border)" }}>
        {[
          canAccessSettings && { href: "/settings", icon: "settings",           label: t.nav.settings },
          canAccessAudit    && { href: "/audit",    icon: "admin_panel_settings",label: t.nav.audit    },
        ].filter(Boolean).map((item) => {
          if (!item) return null;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-[10px] text-[13px] font-medium transition-all duration-150 my-px",
                "hover:bg-[var(--hover)] hover:text-[var(--txt1)]",
                isCollapsed ? "justify-center p-[11px] mx-1" : "gap-3 px-3 py-2.5",
              )}
              style={{ color: "var(--txt2)" }}
            >
              <span className="material-symbols-outlined flex-shrink-0"
                style={{ fontSize: 19, color: "var(--txt3)", fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}>
                {item.icon}
              </span>
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.span
                    key={`bl-${item.href}`}
                    initial="hidden" animate="visible" exit="hidden"
                    variants={lv}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </div>

      {/* ── User profile ───────────────────────── */}
      <div className="flex-shrink-0 px-2 pt-2 pb-3" style={{ borderTop: "1px solid var(--border)" }}>
        <div
          title={isCollapsed ? `${displayName} · ${displayRole}` : undefined}
          className={cn(
            "flex items-center transition-all duration-150 cursor-pointer rounded-[10px]",
            isCollapsed
              ? "justify-center p-[11px] mx-1 hover:bg-[var(--hover)]"
              : "gap-3 p-2.5 hover:bg-[var(--hover)]",
          )}
        >
          {/* Avatar */}
          <div
            className="avatar avatar-md flex-shrink-0"
          >
            {getInitials(displayName)}
          </div>

          {/* Info */}
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                key="user-info"
                initial="hidden" animate="visible" exit="hidden"
                variants={lv}
                className="flex-1 min-w-0 overflow-hidden"
              >
                <p className="text-[13px] font-semibold truncate whitespace-nowrap" style={{ color: "var(--txt1)" }}>
                  {displayName}
                </p>
                <p className="text-[11px] truncate whitespace-nowrap" style={{ color: "var(--txt3)" }}>
                  {displayRole}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {!isCollapsed && (
            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: 18, color: "var(--txt3)" }}>
              more_horiz
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
