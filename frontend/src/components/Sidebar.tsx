"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

const adminNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: "\u25A6" },
  { href: "/schools", label: "Schools", icon: "\u2302" },
  { href: "/sessions", label: "Sessions", icon: "\u2630" },
  { href: "/settings", label: "Settings", icon: "\u2699" },
];

const schoolAdminNavItems = [
  { href: "/school-portal", label: "School Portal", icon: "\u2302" },
  { href: "/settings", label: "Settings", icon: "\u2699" },
];

function RoleBadge({ role }: { role: string }) {
  const label =
    role === "school_admin"
      ? "School Admin"
      : role === "admin"
        ? "Admin"
        : role;

  return (
    <span
      className="inline-block px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider
        rounded-full"
      style={{ background: "rgba(212, 172, 13, 0.2)", color: "#d4ac0d" }}
    >
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
    <aside
      className="w-64 min-h-screen flex flex-col text-white shrink-0"
      style={{ background: "linear-gradient(180deg, #1a5276 0%, #143d54 100%)" }}
    >
      {/* Logo Section */}
      <div className="px-6 pt-7 pb-5 border-b border-white/10">
        <h1 className="text-xl font-bold tracking-tight">
          <span className="text-white">Career</span>
          <span style={{ color: "#d4ac0d" }}>Disha</span>
        </h1>
        <p className="text-white/50 text-xs mt-1 tracking-wide">{portalLabel}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm
                transition-all duration-150 relative
                ${
                  isActive
                    ? "bg-white/[0.12] text-white font-medium"
                    : "text-white/60 hover:bg-white/[0.07] hover:text-white/90"
                }`}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                  style={{ background: "#d4ac0d" }}
                />
              )}
              <span
                className={`text-base w-5 text-center transition-colors duration-150 ${
                  isActive ? "text-white" : "text-white/50 group-hover:text-white/70"
                }`}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="px-4 pb-5 pt-3 border-t border-white/10">
        {user && (
          <div className="flex items-center gap-2 px-3 mb-3">
            {/* Avatar circle */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: "rgba(212, 172, 13, 0.25)", color: "#d4ac0d" }}
            >
              {(user.role || "A").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <RoleBadge role={user.role} />
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/50
            hover:text-white hover:bg-white/[0.07] rounded-lg transition-all duration-150 text-left"
        >
          <span className="text-base w-5 text-center">{"\u2190"}</span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
