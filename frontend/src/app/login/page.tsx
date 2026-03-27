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
  const [rememberDevice, setRememberDevice] = useState(false);
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
      setError("Invalid credentials. Please verify your email or contact your school administrator.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen font-body">
      {/* ── Left Side (55%) ──────────────────────────────── */}
      <section className="hidden lg:flex lg:w-[55%] bg-brand-gradient relative overflow-hidden flex-col justify-between p-16">
        {/* Background dot grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* Branding */}
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-4xl font-heading font-extrabold tracking-tighter text-white">
              Career<span className="text-yellow-400">Disha</span>
            </Link>
          </div>
          <p className="mt-6 text-xl font-heading font-semibold text-white/90 max-w-md leading-relaxed">
            AI-Powered Career Counselling for Indian Schools
          </p>
          <div className="mt-2 text-primary-200 font-medium tracking-wide">
            &#2349;&#2357;&#2367;&#2359;&#2381;&#2351; &#2325;&#2368; &#2360;&#2361;&#2368; &#2342;&#2367;&#2358;&#2366;
          </div>
        </div>

        {/* RIASEC Floating Cards */}
        <div className="relative z-10 grid grid-cols-2 gap-6 max-w-lg">
          <div className="bg-white/[0.08] backdrop-blur-xl p-6 rounded-xl flex items-center gap-4 translate-y-4">
            <div className="w-10 h-10 rounded-full bg-riasec-r flex items-center justify-center text-white font-bold">R</div>
            <div>
              <div className="text-white font-semibold text-sm">Realistic</div>
              <div className="text-white/60 text-xs">Practical &amp; Hands-on</div>
            </div>
          </div>
          <div className="bg-white/[0.08] backdrop-blur-xl p-6 rounded-xl flex items-center gap-4 -translate-y-4">
            <div className="w-10 h-10 rounded-full bg-riasec-i flex items-center justify-center text-white font-bold">I</div>
            <div>
              <div className="text-white font-semibold text-sm">Investigative</div>
              <div className="text-white/60 text-xs">Analytical &amp; Curious</div>
            </div>
          </div>
          <div className="bg-white/[0.08] backdrop-blur-xl p-6 rounded-xl flex items-center gap-4 translate-x-8">
            <div className="w-10 h-10 rounded-full bg-riasec-a flex items-center justify-center text-white font-bold">A</div>
            <div>
              <div className="text-white font-semibold text-sm">Artistic</div>
              <div className="text-white/60 text-xs">Creative &amp; Expressive</div>
            </div>
          </div>
          <div className="bg-white/[0.08] backdrop-blur-xl p-6 rounded-xl flex items-center gap-4 translate-y-8">
            <div className="w-10 h-10 rounded-full bg-riasec-s flex items-center justify-center text-white font-bold">S</div>
            <div>
              <div className="text-white font-semibold text-sm">Social</div>
              <div className="text-white/60 text-xs">Helping &amp; Empathetic</div>
            </div>
          </div>
        </div>

        {/* Abstract blurred orbs */}
        <div className="absolute bottom-0 right-0 w-full h-1/2 pointer-events-none overflow-hidden opacity-20">
          <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-secondary rounded-full blur-[120px]" />
          <div className="absolute top-0 -left-10 w-64 h-64 bg-primary-200 rounded-full blur-[100px]" />
        </div>

        {/* Footer Left */}
        <div className="relative z-10">
          <div className="text-white/40 text-xs font-medium tracking-[0.2em] uppercase">
            Institutional Trust &amp; Scientific Rigor
          </div>
        </div>
      </section>

      {/* ── Right Side (45%) ─────────────────────────────── */}
      <section className="w-full lg:w-[45%] flex flex-col items-center justify-center p-8 lg:p-16 bg-surface">
        <div className="w-full max-w-[420px]">
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

          {/* Header */}
          <div className="mb-10 text-center lg:text-left">
            <h1 className="text-3xl font-heading font-bold text-primary mb-2">Welcome back</h1>
            <p className="text-on-surface-variant font-medium">Sign in to your counsellor account</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-8 p-4 bg-red-50 rounded-lg flex items-start gap-3 animate-slide-in">
              <span className="text-red-600 font-bold text-sm mt-0.5 shrink-0">!</span>
              <div className="text-red-700 text-sm font-medium leading-tight">{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-on-surface tracking-wide" htmlFor="email">
                Work Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-outline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-12 pr-4 py-4 bg-surface-container-high border-none rounded-lg text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary focus:bg-white transition-all duration-200"
                  placeholder="name@school.edu.in"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-semibold text-on-surface tracking-wide" htmlFor="password">
                  Access Password
                </label>
                <a className="text-sm font-bold text-secondary hover:text-secondary-600 transition-colors cursor-pointer">
                  Forgot?
                </a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-outline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-12 pr-12 py-4 bg-surface-container-high border-none rounded-lg text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary focus:bg-white transition-all duration-200"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-outline hover:text-primary transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember Device */}
            <div className="flex items-center">
              <input
                id="remember"
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="w-4 h-4 text-primary bg-surface-container-high border-none rounded focus:ring-primary"
              />
              <label className="ml-2 text-sm font-medium text-on-surface-variant" htmlFor="remember">
                Remember this device for 30 days
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-4 px-6 rounded-lg font-heading font-bold text-lg hover:shadow-xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
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
                <>
                  Sign In to Dashboard
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Student Portal Link */}
          <div className="mt-10 pt-8 border-t border-surface-container-high">
            <p className="text-center text-on-surface-variant text-sm font-medium mb-6">Are you a student?</p>
            <Link
              href="/quiz"
              className="w-full py-3 px-6 rounded-lg border-2 border-primary/10 text-primary font-heading font-bold hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2"
            >
              Student Access Portal
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
              </svg>
            </Link>
          </div>
        </div>

        {/* DPDPA Footer */}
        <footer className="mt-auto pt-12 flex flex-col items-center gap-2">
          <p className="text-xs font-medium text-outline flex items-center gap-1.5 uppercase tracking-widest">
            Powered by CareerDisha AI <span className="text-secondary">&bull;</span> DPDPA Compliant
          </p>
        </footer>
      </section>
    </main>
  );
}
