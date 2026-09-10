"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const STREAM_OPTIONS = [
  { value: "Science (PCM)", label: "Science \u2014 PCM", sub: "Physics, Chemistry, Maths" },
  { value: "Science (PCB)", label: "Science \u2014 PCB", sub: "Physics, Chemistry, Biology" },
  { value: "Commerce", label: "Commerce", sub: "Accounts, Business Studies, Economics" },
  { value: "Arts/Humanities", label: "Arts / Humanities", sub: "History, Geography, Political Science..." },
  { value: "Vocational", label: "Vocational / ITI", sub: "Skill-based programme" },
  { value: "Still deciding", label: "Still deciding", sub: "Haven\u2019t chosen yet" },
];

function OutcomeForm() {
  const searchParams = useSearchParams();
  // `t` is the per-student report token issued with the report.
  const linkToken = searchParams.get("t");

  const [stream, setStream] = useState("");
  const [careerInterest, setCareerInterest] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!linkToken) setError("Invalid link. Please use the link your counsellor gave you.");
  }, [linkToken]);

  const handleSubmit = async () => {
    if (!linkToken || !stream) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/outcomes/public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: linkToken,
          actual_stream_chosen: stream,
          actual_career_interest: careerInterest,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Submission failed");
      }
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !linkToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-secondary-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-on-surface-variant text-sm font-body">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="text-center max-w-sm animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-accent-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="font-heading text-xl font-bold text-primary mb-2">Thank You!</h2>
          <p className="text-on-surface-variant text-sm leading-relaxed font-body">
            Your response has been recorded. This helps us measure how accurately
            CareerNeeti&apos;s recommendations match real-world choices &mdash; improving guidance
            for future students.
          </p>
          <p className="text-xs text-outline mt-6 font-body">&mdash; CareerNeeti Team</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface font-body">
      {/* TopNavBar */}
      <header className="bg-brand-gradient w-full sticky top-0 z-50">
        <div className="flex justify-between items-center px-6 py-4 w-full max-w-form-compact mx-auto">
          <span className="text-xl font-bold text-white font-heading tracking-tight">CareerNeeti</span>
          <span className="text-blue-100/80 text-xs font-medium uppercase tracking-widest">6-Month Follow-Up</span>
        </div>
      </header>

      <main className="w-full max-w-form-compact mx-auto px-4 py-8 space-y-6">
        {/* Intro Card */}
        <section className="bg-white p-8 rounded shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="w-12 h-12 bg-primary-50 flex items-center justify-center rounded-full mb-2">
              <svg className="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-2 .9-2 2v14a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
              </svg>
            </div>
            <h1 className="font-heading text-2xl font-bold text-primary leading-tight">Dear Parent,</h1>
            <p className="text-on-surface-variant leading-relaxed font-body">
              It has been 6 months since your child received their CareerNeeti career report. We would love to know &mdash; which stream did they choose?
            </p>
          </div>
        </section>

        {/* Stream Selection Card */}
        <section className="bg-white p-8 rounded shadow-sm">
          <div className="mb-6">
            <h2 className="font-heading text-lg font-bold text-primary">Which stream/course did your child choose? <span className="text-red-500">*</span></h2>
            <p className="text-on-surface-variant text-xs mt-1">Select the option that best matches their current enrollment.</p>
          </div>
          <div className="flex flex-col gap-2">
            {STREAM_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStream(opt.value)}
                className={`w-full flex justify-between items-center p-4 rounded transition-all duration-200 text-left ${
                  stream === opt.value
                    ? "bg-primary text-white"
                    : "bg-surface-container-high text-primary hover:bg-surface-container-highest"
                }`}
              >
                <span className={stream === opt.value ? "font-semibold" : "font-medium"}>
                  {opt.label}
                  <span className={`text-xs font-normal block ${stream === opt.value ? "opacity-80" : "text-on-surface-variant"}`}>
                    ({opt.sub})
                  </span>
                </span>
                {stream === opt.value && (
                  <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Optional Text Field Card */}
        <section className="bg-white p-8 rounded shadow-sm">
          <label className="font-heading text-lg font-bold text-primary block mb-4" htmlFor="career-interest">
            What career is your child currently interested in? <span className="text-on-surface-variant font-normal text-sm">(optional)</span>
          </label>
          <div className="relative">
            <input
              id="career-interest"
              type="text"
              value={careerInterest}
              onChange={(e) => setCareerInterest(e.target.value)}
              placeholder="e.g. Software engineer, Doctor, CA..."
              className="w-full bg-surface-container-high border-none rounded p-4 text-on-surface focus:ring-2 focus:ring-primary outline-none placeholder:text-outline/60"
            />
          </div>
        </section>

        {error && (
          <div className="bg-red-50 rounded p-3 text-red-600 text-sm text-center font-body">
            {error}
          </div>
        )}

        {/* Primary Action */}
        <section className="pt-4">
          <button
            onClick={handleSubmit}
            disabled={submitting || !stream}
            className="w-full py-5 px-6 bg-gold-gradient text-white font-heading font-bold text-lg rounded shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting..." : "Submit Response"}
            {!submitting && (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            )}
          </button>
        </section>

        {/* Educational Credibility Section */}
        <section className="flex items-center gap-4 p-4 bg-surface-container-high rounded-lg opacity-80">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
            </svg>
          </div>
          <p className="text-xs text-on-surface-variant leading-tight">
            This follow-up is part of our longitudinal career success tracking designed to refine AI recommendations for future Indian students.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-surface-container-highest mt-12">
        <div className="flex flex-col items-center gap-6 w-full max-w-form-compact mx-auto text-center px-4 py-12">
          <p className="text-slate-500 text-xs tracking-wide max-w-[400px]">
            Your response is used only for improving CareerNeeti recommendations. Data handled per DPDPA guidelines.
          </p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <span className="text-slate-500 text-xs">Privacy Policy</span>
            <span className="text-slate-500 text-xs">DPDPA Compliance</span>
            <span className="text-slate-500 text-xs">Terms of Service</span>
          </div>
          <div className="mt-4 opacity-50">
            <p className="text-[10px] text-slate-400 font-medium">CareerNeeti. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function OutcomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-surface">
          <div className="w-8 h-8 border-4 border-surface-container-high border-t-primary rounded-full animate-spin" />
        </div>
      }
    >
      <OutcomeForm />
    </Suspense>
  );
}
