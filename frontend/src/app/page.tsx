"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-surface font-body">
      {/* ── Glassmorphic Navbar ─────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-primary/80">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="font-heading text-xl font-extrabold tracking-tight">
            <span className="text-white">Career</span>
            <span className="text-secondary">Disha</span>
          </Link>
          <div className="hidden sm:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm text-white/70 hover:text-white transition-colors font-body">
              How It Works
            </a>
            <a href="#testimonials" className="text-sm text-white/70 hover:text-white transition-colors font-body">
              Testimonials
            </a>
            <a href="#pricing" className="text-sm text-white/70 hover:text-white transition-colors font-body">
              Pricing
            </a>
          </div>
          <Link
            href="/login"
            className="text-sm font-semibold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 px-5 py-2 rounded transition-all"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* ── Hero Section ───────────────────────────────────── */}
      <section className="bg-brand-gradient pt-28 pb-20 sm:pt-36 sm:pb-28 relative overflow-hidden">
        {/* Subtle dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative z-10 max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left column — 60% */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 bg-secondary/15 text-secondary text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-6 font-body">
                AI-Powered Career Guidance
              </div>
              <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] mb-6">
                Discover the right career{" "}
                <span className="text-secondary">before Class 11</span>
              </h1>
              <p className="font-body text-white/60 text-lg sm:text-xl leading-relaxed mb-10 max-w-lg">
                CareerDisha uses a RIASEC psychometric assessment to give Indian students
                a personalised career report — backed by science, delivered in minutes.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/quiz" className="btn-gold px-8 py-3.5 text-base rounded-lg hover:scale-105">
                  Try Free Quiz &rarr;
                </Link>
                <Link href="/assessment" className="btn-primary px-8 py-3.5 text-base rounded-lg hover:scale-105">
                  Get Full Report — ₹499
                </Link>
              </div>
            </div>

            {/* Right column — 40%: feature pills + decorative element */}
            <div className="lg:col-span-5 hidden lg:flex flex-col items-center justify-center">
              <div className="relative w-full max-w-xs">
                {/* Decorative gradient orb */}
                <div className="absolute -top-10 -right-10 w-64 h-64 bg-secondary/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-accent/10 rounded-full blur-3xl" />
                {/* Floating stat cards */}
                <div className="relative space-y-4">
                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-5">
                    <p className="font-heading text-3xl font-extrabold text-white">74</p>
                    <p className="font-body text-white/50 text-sm mt-1">Calibrated Questions</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-5">
                    <p className="font-heading text-3xl font-extrabold text-secondary">6</p>
                    <p className="font-body text-white/50 text-sm mt-1">RIASEC Personality Dimensions</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-5">
                    <p className="font-heading text-3xl font-extrabold text-accent">PDF</p>
                    <p className="font-body text-white/50 text-sm mt-1">Personalised Report via WhatsApp</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile feature pills */}
          <div className="flex flex-wrap gap-3 justify-start mt-14 lg:hidden">
            {["RIASEC Psychometric Test", "74 Questions", "Personalised PDF Report", "WhatsApp Delivery", "DPDPA Compliant"].map((f) => (
              <span key={f} className="text-xs text-white/50 bg-white/5 px-3 py-1.5 rounded-full font-body">
                {f}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────── */}
      <section id="how-it-works" className="bg-surface py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="font-body text-secondary text-sm font-bold tracking-widest uppercase mb-3">
              Simple Process
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-on-surface">
              How It Works
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Take the Assessment",
                description:
                  "Answer 74 scientifically calibrated RIASEC questions. Takes about 15 minutes — no preparation needed.",
              },
              {
                step: "02",
                title: "AI Analyses Your Profile",
                description:
                  "Our AI engine maps your personality across 6 dimensions and matches you with the most fitting career paths.",
              },
              {
                step: "03",
                title: "Get Your Career Report",
                description:
                  "Receive a personalised PDF report with career recommendations, stream suggestions, and next steps — delivered via WhatsApp.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="sa-card relative group hover:bg-surface-container-high transition-colors duration-300"
              >
                <span className="font-heading text-6xl font-extrabold text-surface-container-high group-hover:text-surface-dim transition-colors duration-300 absolute top-4 right-6 select-none">
                  {item.step}
                </span>
                <div className="relative z-10 pt-8">
                  <h3 className="font-heading text-lg font-bold text-on-surface mb-3">
                    {item.title}
                  </h3>
                  <p className="font-body text-on-surface-variant text-sm leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social Proof ───────────────────────────────────── */}
      <section id="testimonials" className="bg-surface-container-high py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="font-body text-secondary text-sm font-bold tracking-widest uppercase mb-3">
              Social Proof
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-on-surface">
              Trusted by 50+ Schools
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                quote:
                  "CareerDisha gave our Class 10 students clarity they never had before. The reports are thorough and parent-friendly.",
                name: "Mrs. Sunita Sharma",
                role: "Principal, DPS Noida",
              },
              {
                quote:
                  "We ran sessions across three batches. The RIASEC approach is scientific and the AI recommendations were spot-on.",
                name: "Mr. Rajesh Iyer",
                role: "Career Counsellor, Kendriya Vidyalaya",
              },
              {
                quote:
                  "Students actually enjoyed it — they found it insightful. The WhatsApp delivery made it easy for parents too.",
                name: "Dr. Priya Menon",
                role: "Vice Principal, Ryan International",
              },
            ].map((t) => (
              <div key={t.name} className="sa-card flex flex-col justify-between">
                <p className="font-body text-on-surface-variant text-sm leading-relaxed mb-6">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div>
                  <p className="font-heading text-sm font-bold text-on-surface">{t.name}</p>
                  <p className="font-body text-xs text-on-surface-variant">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────── */}
      <section id="pricing" className="bg-surface py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="font-body text-secondary text-sm font-bold tracking-widest uppercase mb-3">
              Plans
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-on-surface">
              Choose Your Path
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Free Quiz Card */}
            <div className="sa-card flex flex-col">
              <h3 className="font-heading text-xl font-bold text-on-surface mb-2">Free Quiz</h3>
              <p className="font-heading text-4xl font-extrabold text-on-surface mb-1">
                ₹0
              </p>
              <p className="font-body text-sm text-on-surface-variant mb-6">No signup required</p>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  "10 sample RIASEC questions",
                  "Basic personality snapshot",
                  "Top career direction hint",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="text-accent mt-0.5 text-sm font-bold">&#10003;</span>
                    <span className="font-body text-sm text-on-surface-variant">{item}</span>
                  </li>
                ))}
              </ul>
              <Link href="/quiz" className="btn-ghost w-full py-3 rounded-lg text-center">
                Try Free Quiz
              </Link>
            </div>

            {/* Full Report Card — gold accent */}
            <div className="sa-card flex flex-col relative overflow-hidden">
              {/* Gold accent top bar */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gold-gradient" />
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-heading text-xl font-bold text-on-surface">Full Report</h3>
                <span className="bg-secondary/15 text-secondary text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full">
                  Popular
                </span>
              </div>
              <p className="font-heading text-4xl font-extrabold text-on-surface mb-1">
                ₹499
              </p>
              <p className="font-body text-sm text-on-surface-variant mb-6">Per student</p>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  "Full 74-question RIASEC assessment",
                  "Detailed personality analysis",
                  "Personalised career recommendations",
                  "Stream & subject suggestions",
                  "PDF report via WhatsApp",
                  "DPDPA compliant data handling",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="text-secondary mt-0.5 text-sm font-bold">&#10003;</span>
                    <span className="font-body text-sm text-on-surface-variant">{item}</span>
                  </li>
                ))}
              </ul>
              <Link href="/assessment" className="btn-gold w-full py-3 rounded-lg text-center">
                Get Full Report
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="bg-brand-gradient py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="font-heading text-lg font-extrabold tracking-tight">
            <span className="text-white">Career</span>
            <span className="text-secondary">Disha</span>
          </div>
          <p className="font-body text-xs text-white/40">
            &copy; {new Date().getFullYear()} CareerDisha. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
