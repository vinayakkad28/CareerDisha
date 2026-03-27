"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!password) {
      setError("Password is required.");
      return;
    }
    setLoading(true);
    try {
      await login(password, email || undefined);
      router.replace("/dashboard");
    } catch {
      setError("Invalid credentials. Please check your password and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex font-body">
      {/* ── Left Panel: Navy Gradient with Branding ──────── */}
      <div className="hidden lg:flex lg:w-[55%] bg-brand-gradient relative overflow-hidden flex-col items-center justify-center px-12">
        {/* Subtle dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Decorative orbs */}
        <div className="absolute top-20 right-20 w-72 h-72 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-56 h-56 bg-accent/10 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-md text-center">
          <Link href="/" className="font-heading text-4xl font-extrabold tracking-tight inline-block mb-6">
            <span className="text-white">Career</span>
            <span className="text-secondary">Disha</span>
          </Link>
          <p className="font-body text-white/60 text-lg leading-relaxed">
            AI-Powered Career Counselling for Indian Schools.
            Science-backed assessments. Personalised career reports.
          </p>
          <div className="flex items-center justify-center gap-6 mt-10">
            {["RIASEC Based", "74 Questions", "PDF Reports"].map((pill) => (
              <span
                key={pill}
                className="text-xs text-white/40 bg-white/5 px-3 py-1.5 rounded-full font-body"
              >
                {pill}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel: Login Form ──────────────────────── */}
      <div className="w-full lg:w-[45%] bg-surface-container flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <Link href="/" className="font-heading text-3xl font-extrabold tracking-tight inline-block">
              <span className="text-primary">Career</span>
              <span className="text-secondary">Disha</span>
            </Link>
            <p className="font-body text-on-surface-variant text-sm mt-2">
              AI-Powered Career Counselling
            </p>
          </div>

          <h2 className="font-heading text-2xl font-extrabold text-on-surface mb-1">
            Welcome back
          </h2>
          <p className="font-body text-on-surface-variant text-sm mb-8">
            Sign in to your counsellor dashboard
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label className="block font-body text-sm font-medium text-on-surface mb-1.5">
                Email{" "}
                <span className="text-on-surface-variant font-normal">(for counsellor accounts)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="sa-input"
                placeholder="you@example.com"
                autoFocus
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block font-body text-sm font-medium text-on-surface mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="sa-input pr-14"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60
                    hover:text-on-surface transition-colors p-1 text-xs font-semibold select-none"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2.5 p-3 bg-red-50 rounded animate-slide-in">
                <span className="text-red-500 text-sm mt-0.5 shrink-0 font-bold">!</span>
                <p className="font-body text-red-600 text-sm">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 rounded-lg text-base"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-10 pt-6">
            <p className="text-center font-body text-xs text-on-surface-variant/50 tracking-wide">
              Powered by AI &middot; CBSE Compliant
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
