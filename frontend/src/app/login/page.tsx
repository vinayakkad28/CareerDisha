"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

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
    <div className="min-h-screen flex items-center justify-center bg-brand-gradient relative overflow-hidden">
      {/* Subtle background pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 sm:p-10">
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight">
              <span style={{ color: "#1a5276" }}>Career</span>
              <span style={{ color: "#d4ac0d" }}>Disha</span>
            </h1>
            <p className="text-gray-500 text-sm mt-2 tracking-wide">
              AI-Powered Career Counselling for Indian Schools
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email{" "}
                <span className="text-gray-400 font-normal">(for counsellor accounts)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm
                  focus:ring-2 focus:ring-[#1a5276]/20 focus:border-[#1a5276] outline-none
                  transition-all duration-200 bg-gray-50 focus:bg-white
                  placeholder:text-gray-400"
                placeholder="you@example.com"
                autoFocus
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl text-sm
                    focus:ring-2 focus:ring-[#1a5276]/20 focus:border-[#1a5276] outline-none
                    transition-all duration-200 bg-gray-50 focus:bg-white
                    placeholder:text-gray-400"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                    hover:text-gray-600 transition-colors p-1 text-sm select-none"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                <span className="text-red-400 text-sm mt-0.5 shrink-0">!</span>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-white rounded-xl font-semibold text-sm
                transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed
                hover:shadow-lg hover:shadow-[#1a5276]/25 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #1a5276 0%, #0d2b3e 100%)",
              }}
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

          {/* Divider */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-center text-xs text-gray-400 tracking-wide">
              Powered by AI &middot; CBSE Compliant
            </p>
          </div>
        </div>

        {/* Footer below card */}
        <p className="text-center text-xs text-white/40 mt-6">
          &copy; {new Date().getFullYear()} CareerDisha. All rights reserved.
        </p>
      </div>
    </div>
  );
}
