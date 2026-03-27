"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

const adminNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/schools", label: "Schools", icon: "school" },
  { href: "/sessions", label: "Sessions", icon: "sessions" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

const schoolAdminNavItems = [
  { href: "/school-portal", label: "School Dashboard", icon: "dashboard" },
  { href: "/sessions", label: "Sessions", icon: "sessions" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

const NAV_ICONS: Record<string, React.ReactNode> = {
  dashboard: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
    </svg>
  ),
  school: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3m4-10h1m4 0h1m-5 4h1m4 0h1M9 7h1m4 0h1" />
    </svg>
  ),
  sessions: (
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
  help: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  logout: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
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
    <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter rounded bg-secondary/20 text-secondary">
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
    <aside className="w-sidebar min-h-screen flex flex-col text-white shrink-0 bg-sidebar-gradient py-8">
      {/* Logo */}
      <div className="px-6 mb-10">
        <h1 className="text-2xl font-heading font-extrabold tracking-tight">
          <span className="text-white">Career</span>
          <span className="text-secondary">Disha</span>
        </h1>
        <p className="text-xs font-medium text-primary-200 tracking-wider uppercase opacity-80 mt-1">
          {portalLabel}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-6 py-3 text-sm transition-all duration-200
                ${
                  isActive
                    ? "text-white bg-white/10 font-bold border-l-4 border-secondary"
                    : "text-slate-300 hover:text-white hover:bg-white/5"
                }`}
            >
              <span className={isActive ? "text-white" : "text-slate-300"}>
                {NAV_ICONS[item.icon]}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* CTA Button */}
      <div className="px-6 mb-8">
        <Link
          href="/sessions/new"
          className="w-full py-3 bg-secondary hover:bg-secondary-300 text-primary-900 font-bold rounded-lg flex items-center justify-center gap-2 transition-transform active:scale-95 text-sm"
        >
          <span className="text-lg leading-none">+</span>
          <span>New Session</span>
        </Link>
      </div>

      {/* User Profile Bottom */}
      <div className="px-6 pt-6 border-t border-white/10">
        {user && (
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-sm font-bold shrink-0 text-primary">
              {(user.role || "A").charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">
                {role === "school_admin" ? "School Admin" : "Admin User"}
              </p>
              <RoleBadge role={user.role} />
            </div>
          </div>
        )}

        {/* Help */}
        <button
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs font-medium mb-2 w-full px-0 py-1"
        >
          {NAV_ICONS.help}
          <span>Help</span>
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs font-medium w-full px-0 py-1"
        >
          {NAV_ICONS.logout}
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
