"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, getInitials } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}

interface SidebarProps {
  user?: { name: string; role: string; photo?: string };
}

const navItems: NavItem[] = [
  { label: "Dashboard",    href: "/",            icon: "dashboard" },
  { label: "Patients",     href: "/patients",    icon: "person" },
  { label: "Appointments", href: "/appointments",icon: "calendar_today" },
  { label: "EMR",          href: "/emr",         icon: "clinical_notes" },
  { label: "Billing",      href: "/billing",     icon: "payments" },
  { label: "Pharmacy",     href: "/pharmacy",    icon: "medication" },
  { label: "Laboratory",   href: "/laboratory",  icon: "biotech" },
  { label: "Radiology",    href: "/radiology",   icon: "image_search" },
  { label: "HR",           href: "/hr",          icon: "badge" },
  { label: "Accounting",   href: "/accounting",  icon: "account_balance" },
  { label: "Reports",      href: "/reports",     icon: "bar_chart" },
  { label: "Users & RBAC", href: "/users",       icon: "manage_accounts" },
];

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const displayName = user?.name ?? "User";
  const displayRole = user?.role ?? "Staff";

  return (
    <aside className="flex flex-col h-screen w-64 border-r border-[#e3e2e6] bg-[#faf9fd] py-4 px-4 sticky top-0 flex-shrink-0">
      {/* Brand */}
      <div className="mb-6 px-2 pt-2">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 bg-[#002045] rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-white text-sm">local_hospital</span>
          </div>
          <h1 className="font-bold text-xl text-[#002045]">MediFlow CMS</h1>
        </div>
        <p className="text-xs text-[#74777f] pl-10">Clinical Management Portal</p>
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
              {item.badge !== undefined && item.badge > 0 && (
                <span className="ml-auto bg-[#ba1a1a] text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {item.badge}
                </span>
              )}
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
          <span>Settings</span>
        </Link>
        <Link
          href="/audit"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#43474e] hover:bg-[#f4f3f7] hover:text-[#1a1c1e] transition-all duration-150"
        >
          <span className="material-symbols-outlined text-[20px] text-[#74777f]">admin_panel_settings</span>
          <span>Audit Logs</span>
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
