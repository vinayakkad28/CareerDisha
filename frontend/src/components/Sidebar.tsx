"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

const adminNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/schools", label: "Schools", icon: "🏫" },
  { href: "/sessions", label: "Sessions", icon: "📋" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

const schoolAdminNavItems = [
  { href: "/school-portal", label: "School Portal", icon: "🏫" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();

  const role = user?.role || "admin";
  const navItems = role === "school_admin" ? schoolAdminNavItems : adminNavItems;
  const portalLabel = role === "school_admin" ? "School Portal" : "Admin Portal";

  return (
    <aside className="w-64 bg-primary text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-primary-700">
        <h1 className="text-xl font-bold">CareerDisha</h1>
        <p className="text-primary-200 text-sm mt-1">{portalLabel}</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-white/15 text-white font-medium"
                  : "text-primary-200 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-primary-700">
        {user && (
          <p className="text-primary-200 text-xs mb-2 px-4 truncate">{user.role}</p>
        )}
        <button
          onClick={logout}
          className="w-full px-4 py-2 text-sm text-primary-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-left"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
