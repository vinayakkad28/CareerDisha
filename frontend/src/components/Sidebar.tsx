"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

const adminNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/schools", label: "Schools", icon: "building" },
  { href: "/sessions", label: "Sessions", icon: "calendar" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

const schoolAdminNavItems = [
  { href: "/school-portal", label: "School Dashboard", icon: "grid" },
  { href: "/sessions", label: "Sessions", icon: "calendar" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

const NAV_ICONS: Record<string, React.ReactNode> = {
  grid: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
    </svg>
  ),
  building: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3m4-10h1m4 0h1m-5 4h1m4 0h1M9 7h1m4 0h1" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  settings: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  logout: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
};

function RoleBadge({ role }: { role: string }) {
  const label =
    role === "school_admin"
      ? "School Admin"
      : role === "admin"
        ? "Admin"
        : role;

  return (
    <span className="inline-block px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-secondary/20 text-secondary">
      {label}
    </span>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();

  const role = user?.role || "admin";
  const navItems = role === "school_admin" ? schoolAdminNavItems : adminNavItems;
  const portalLabel =
    role === "school_admin" ? "School Portal" : "Admin Portal";

  return (
    <aside className="w-sidebar min-h-screen flex flex-col text-white shrink-0 bg-sidebar-gradient">
      {/* Logo */}
      <div className="px-6 pt-7 pb-5">
        <h1 className="text-xl font-heading font-bold tracking-tight">
          <span className="text-white">Career</span>
          <span className="text-secondary">Disha</span>
        </h1>
        <p className="text-primary-200 text-xs mt-1 tracking-wide">{portalLabel}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 px-4 py-2.5 rounded text-sm
                transition-all duration-150 relative
                ${
                  isActive
                    ? "bg-white/[0.12] text-white font-medium"
                    : "text-white/60 hover:bg-white/[0.07] hover:text-white/90"
                }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-secondary" />
              )}
              <span className={`transition-colors duration-150 ${
                isActive ? "text-white" : "text-white/50 group-hover:text-white/70"
              }`}>
                {NAV_ICONS[item.icon]}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="px-4 pb-5 pt-3">
        {user && (
          <div className="flex items-center gap-2.5 px-3 mb-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-secondary/25 text-secondary">
              {(user.role || "A").charAt(0).toUpperCase()}
            </div>
            <RoleBadge role={user.role} />
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/50
            hover:text-white hover:bg-white/[0.07] rounded transition-all duration-150 text-left"
        >
          {NAV_ICONS.logout}
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
