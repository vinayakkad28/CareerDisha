"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ToastProvider } from "@/components/Toast";
import Sidebar from "@/components/Sidebar";

// Staff areas that require a login. Listed explicitly rather than treating
// "anything not public" as protected: under that rule a mistyped URL matched no
// public route, so a parent following a stale link was redirected to the
// internal counsellor login instead of seeing the 404 page — which was
// therefore unreachable. Unknown paths now fall through to not-found.
//
// This gate is convenience only. The real control is server-side: every staff
// endpoint resolves the caller's scope in the backend (see backend/access.py).
const PROTECTED_ROUTES = [
  "/dashboard",
  "/schools",
  "/sessions",
  "/students",
  "/settings",
  "/school-portal",
  "/counsellors",
  "/coaching",
];

function isProtectedRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return PROTECTED_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated && isProtectedRoute(pathname)) {
      router.replace("/login");
    }
  }, [loading, isAuthenticated, pathname, router]);

  // Public pages, and unknown paths that resolve to the 404, render bare —
  // no staff sidebar.
  //
  // This check MUST come before the `loading` gate below. AuthProvider starts
  // with loading=true and only resolves in a client effect, so gating public
  // routes on it made every public page — the landing page included — server
  // render as nothing but a spinner: an 8.4KB body with no headline, no copy
  // and no crawlable content, plus a visible flash for real users. Public
  // routes do not depend on auth state, so they must never wait for it.
  if (!isProtectedRoute(pathname)) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Protected but not yet redirected — show spinner while redirect fires
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 px-8 py-8 overflow-auto">{children}</main>
    </div>
  );
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ToastProvider>
        <LayoutContent>{children}</LayoutContent>
      </ToastProvider>
    </AuthProvider>
  );
}
