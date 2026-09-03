"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-surface font-body">
      {/* ── Glassmorphic Navbar ─────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-3 rounded-full mt-6 mx-auto max-w-5xl bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-xl font-heading text-sm font-semibold tracking-tight">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold tracking-tighter text-white">
            Career<span className="text-secondary">Neeti</span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          <a href="#how-it-works" className="text-white/90 hover:text-white transition-colors hover:bg-white/10 rounded-full px-3 py-1">
            Counselling
          </a>
          <a href="#how-it-works" className="text-white/90 hover:text-white transition-colors hover:bg-white/10 rounded-full px-3 py-1">
            RIASEC Test
          </a>
          <a href="#for-schools" className="text-white/90 hover:text-white transition-colors hover:bg-white/10 rounded-full px-3 py-1">
            For Schools
          </a>
          <a href="#pricing" className="text-white/90 hover:text-white transition-colors hover:bg-white/10 rounded-full px-3 py-1">
            Pricing
          </a>
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-white/90 font-semibold hover:text-white px-4 py-2 transition-all">
            Login
          </Link>
          <Link href="/assessment" className="btn-gold px-6 py-2 rounded-full font-bold shadow-lg active:scale-95 duration-200">
            Get Started
          </Link>
        </div>
      </header>

      <main className="pt-32">
        {/* ── Hero Section ───────────────────────────────────── */}
        <section className="max-w-7xl mx-auto px-8 mb-24">
          <div className="flex flex-col md:flex-row items-center gap-16">
            {/* Left Content */}
            <div className="w-full md:w-[60%]">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary-100 text-secondary-600 text-xs font-bold tracking-widest uppercase mb-6">
                AI-Powered Career Guidance
              </span>
              <h1 className="font-heading text-5xl md:text-6xl font-extrabold leading-[1.1] text-primary mb-6 tracking-tight">
                Discover the right career <br />
                <span className="text-secondary">before Class 11</span>
              </h1>
              <p className="text-lg text-on-surface-variant max-w-xl mb-10 leading-relaxed">
                Navigate your future with India&apos;s most advanced RIASEC psychometric assessment.
                Designed for the unique landscape of Indian education, giving students scientific
                clarity on streams and careers.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/quiz"
                  className="btn-gold px-8 py-4 rounded-lg font-bold shadow-xl flex items-center gap-2 hover:brightness-110 transition-all"
                >
                  Try Free Quiz &rarr;
                </Link>
                <Link
                  href="/assessment"
                  className="btn-primary px-8 py-4 rounded-lg font-bold shadow-xl hover:brightness-110 transition-all"
                >
                  Get Full Report — Free
                </Link>
              </div>
            </div>

            {/* Right Illustration */}
            <div className="w-full md:w-[40%] relative">
              <div className="aspect-square rounded-2xl overflow-hidden bg-surface-container-high relative group">
                {/* Placeholder image area with gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-surface-container-high" />
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-64 h-64 border-2 border-secondary/30 rounded-full animate-pulse flex items-center justify-center">
                    <div className="w-48 h-48 border border-white/20 rounded-full flex items-center justify-center">
                      <svg className="w-16 h-16 text-secondary" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13 3C9.2 3 6.2 5.9 6 9.7l-2 3.3c-.3.5 0 1 .5 1h1.5v3c0 1.1.9 2 2 2h1v3h7v-4.7c2.4-1.2 4-3.7 4-6.3 0-4.4-3.6-8-8-8zm-1 15h-2v-1h2v1zm3.1-4.4l-.9.5V16h-4v-1.9l-.9-.5C7.8 12.9 7 11.5 7 10c0-3.3 2.7-6 6-6s6 2.7 6 6c0 1.5-.8 2.9-2.9 3.6z"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              {/* Tonal Accent */}
              <div className="absolute -z-10 -bottom-6 -right-6 w-full h-full bg-primary-100 rounded-2xl opacity-50" />
            </div>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-20">
            {[
              { icon: "RIASEC", label: "RIASEC Psychometric Test" },
              { icon: "5", label: "Interests, Aptitude & Personality" },
              { icon: "PDF", label: "Personalised PDF Report" },
              { icon: "हिं", label: "English & हिन्दी" },
              { icon: "₹0", label: "Free while in beta" },
            ].map((pill) => (
              <div
                key={pill.label}
                className="flex items-center gap-2 px-4 py-2 bg-surface-container-high rounded-full text-sm font-semibold text-primary"
              >
                <span className="text-xs font-bold text-primary/60">{pill.icon}</span> {pill.label}
              </div>
            ))}
          </div>
        </section>

        {/* ── How It Works ───────────────────────────────────── */}
        <section id="how-it-works" className="bg-surface-container-high py-24">
          <div className="max-w-7xl mx-auto px-8">
            <div className="text-center mb-16">
              <h2 className="font-heading text-4xl font-bold text-primary mb-4">How It Works</h2>
              <p className="text-on-surface-variant font-medium">
                Science-backed guidance in three simple steps
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  step: "01",
                  title: "Take the Assessment",
                  description:
                    "Interests, work values, aptitude and personality — about 40 minutes, and you can skip the optional sections.",
                },
                {
                  step: "02",
                  title: "AI Analyzes Your Interests",
                  description:
                    "Our proprietary algorithms process your data to identify the ideal career clusters for your personality.",
                },
                {
                  step: "03",
                  title: "Get Career Roadmap PDF",
                  description:
                    "Receive a detailed personalised PDF report with stream recommendations and action steps for Class 11.",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="sa-card p-10 rounded-xl relative group hover:bg-primary transition-colors duration-300"
                >
                  <span className="text-6xl font-heading font-extrabold text-surface-container-high absolute top-4 right-8 group-hover:text-white/10 transition-colors">
                    {item.step}
                  </span>
                  <div className="mb-8 p-3 bg-primary-100 w-fit rounded-lg group-hover:bg-white/20 transition-colors">
                    <svg
                      className="w-8 h-8 text-primary group-hover:text-white transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      {item.step === "01" && (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      )}
                      {item.step === "02" && (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      )}
                      {item.step === "03" && (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      )}
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-primary mb-4 group-hover:text-white transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-on-surface-variant group-hover:text-white/80 leading-relaxed transition-colors">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Social Proof ───────────────────────────────────── */}
        <section id="for-schools" className="py-24 max-w-7xl mx-auto px-8">
          <div className="flex flex-col items-center mb-12">
            <h2 className="font-heading text-3xl font-bold text-primary mb-2 text-center">
              For Schools
            </h2>
            <div className="w-24 h-1 bg-secondary rounded-full" />
          </div>
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-on-surface-variant leading-relaxed mb-6">
              CBSE now requires affiliated schools to appoint a career counsellor, distinct from the
              wellness counsellor, at a ratio of one per 500 students for Classes 9&ndash;12. Schools
              are permitted to share resources under a hub-and-spoke model.
            </p>
            <p className="text-on-surface-variant leading-relaxed mb-8">
              CareerNeeti runs structured assessment sessions on site and returns a personalised
              report for every student, along with an aggregate profile of the cohort for your
              counselling records.
            </p>
            <a
              href="mailto:hello@careerneeti.in?subject=CareerNeeti%20for%20our%20school"
              className="inline-block px-8 py-3 bg-primary text-white rounded-full font-semibold hover:bg-primary/90 transition-colors"
            >
              Talk to us about your school
            </a>
          </div>
        </section>

        {/* ── Pricing ────────────────────────────────────────── */}
        <section id="pricing" className="py-24 bg-surface">
          <div className="max-w-4xl mx-auto px-8">
            <div className="text-center mb-16">
              <h2 className="font-heading text-4xl font-bold text-primary mb-4">Choose Your Path</h2>
              <p className="text-on-surface-variant">Investment in clarity for a lifetime of success</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {/* Free Tier */}
              <div className="sa-card p-10 rounded-xl shadow-sm border-t-4 border-slate-200 flex flex-col">
                <h3 className="text-2xl font-bold text-primary mb-2">Free Quiz</h3>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-primary">₹0</span>
                </div>
                <ul className="space-y-4 mb-10 flex-grow">
                  {[
                    "15 high-impact questions",
                    "Preliminary stream prediction",
                    "Instant on-screen results",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-on-surface-variant">
                      <span className="text-accent font-bold text-sm mt-0.5">&#10003;</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/quiz"
                  className="btn-ghost w-full py-4 rounded-lg text-center font-bold border-2 border-primary text-primary hover:bg-primary hover:text-white transition-colors"
                >
                  Start Basic Quiz
                </Link>
              </div>

              {/* Paid Tier */}
              <div className="sa-card p-10 rounded-xl shadow-2xl border-t-4 border-secondary flex flex-col relative md:scale-105">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-secondary text-white text-[10px] font-black tracking-widest uppercase px-4 py-1 rounded-full">
                  Most Popular
                </div>
                <h3 className="text-2xl font-bold text-primary mb-2">Full Report</h3>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-primary">₹0</span>
                  <span className="ml-2 text-sm font-semibold text-on-surface-variant">
                    free while in beta
                  </span>
                </div>
                <ul className="space-y-4 mb-10 flex-grow">
                  {[
                    "Full assessment: interests, work values, aptitude & personality",
                    "Personalised PDF Report",
                    "Career Roadmap & Action Plan",
                    "Parent Insight Section",
                    "Life-time access to dashboard",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-on-surface-variant font-medium">
                      <span className="text-secondary font-bold text-sm mt-0.5">&#10003;</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/assessment"
                  className="btn-gold w-full py-4 rounded-lg text-center font-bold shadow-lg hover:brightness-110 transition-all"
                >
                  Get Your Full Report
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="bg-slate-900 py-12 px-8">
        <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center">
          <div className="mb-8 md:mb-0">
            <span className="font-heading font-bold text-xl text-white">
              Career<span className="text-secondary">Neeti</span>
            </span>
            <p className="mt-4 font-body text-sm text-slate-400 max-w-xs leading-relaxed">
              &copy; {new Date().getFullYear()} CareerNeeti AI. Empowering India&apos;s Youth through Scientific Guidance.
            </p>
          </div>
          <div className="flex gap-8">
            <Link className="text-slate-400 hover:text-yellow-500 transition-colors text-sm font-body" href="/privacy">
              Privacy Policy
            </Link>
            <Link className="text-slate-400 hover:text-yellow-500 transition-colors text-sm font-body" href="/terms">
              Terms of Service
            </Link>
            <Link className="text-slate-400 hover:text-yellow-500 transition-colors text-sm font-body" href="/contact">
              Contact Us
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
