"use client";

import Link from "next/link";

const NAVY = "#1a5276";
const GOLD = "#d4ac0d";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #0d2b3e 100%)` }}>
      {/* Nav */}
      <nav className="flex justify-between items-center px-6 py-4 max-w-5xl mx-auto w-full">
        <h1 className="text-xl font-bold">
          <span className="text-white">Career</span>
          <span style={{ color: GOLD }}>Disha</span>
        </h1>
        <Link
          href="/login"
          className="text-sm text-white/70 hover:text-white border border-white/20 px-4 py-1.5 rounded-lg transition-colors"
        >
          Sign In
        </Link>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16">
        <div className="max-w-2xl">
          <div
            className="inline-block text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full mb-6"
            style={{ background: `${GOLD}22`, color: GOLD }}
          >
            AI-Powered Career Guidance
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-4">
            Discover the right career<br />
            <span style={{ color: GOLD }}>before Class 11</span>
          </h2>
          <p className="text-white/60 text-lg mb-10 leading-relaxed">
            CareerDisha uses a RIASEC psychometric assessment to give Indian students
            a personalised career report — backed by science, delivered in minutes.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/quiz"
              className="px-8 py-3.5 rounded-xl font-semibold text-sm transition-all hover:shadow-xl hover:scale-105"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #b8960b)`, color: NAVY }}
            >
              Try Free Quiz →
            </Link>
            <Link
              href="/assessment"
              className="px-8 py-3.5 rounded-xl font-semibold text-sm border border-white/20 text-white hover:bg-white/10 transition-all"
            >
              Get Full Report — ₹499
            </Link>
          </div>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-3 justify-center mt-14">
          {["RIASEC Psychometric Test", "74 Questions", "Personalised PDF Report", "WhatsApp Delivery", "DPDPA Compliant"].map((f) => (
            <span key={f} className="text-xs text-white/50 border border-white/10 px-3 py-1.5 rounded-full">
              {f}
            </span>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-white/20 pb-6">
        &copy; {new Date().getFullYear()} CareerDisha. All rights reserved.
      </p>
    </div>
  );
}
