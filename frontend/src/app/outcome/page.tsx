"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const STREAM_OPTIONS = [
  { value: "Science (PCM)", label: "Science — PCM", sub: "Physics, Chemistry, Maths" },
  { value: "Science (PCB)", label: "Science — PCB", sub: "Physics, Chemistry, Biology" },
  { value: "Commerce", label: "Commerce", sub: "Accounts, Business Studies, Economics" },
  { value: "Arts/Humanities", label: "Arts / Humanities", sub: "History, Geography, Political Science..." },
  { value: "Vocational", label: "Vocational / ITI", sub: "Skill-based programme" },
  { value: "Still deciding", label: "Still deciding", sub: "Haven't chosen yet" },
];

function OutcomeForm() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get("sid");

  const [stream, setStream] = useState("");
  const [careerInterest, setCareerInterest] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!studentId) setError("Invalid link. Please use the link from your WhatsApp message.");
  }, [studentId]);

  const handleSubmit = async () => {
    if (!studentId || !stream) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/outcomes/public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: parseInt(studentId),
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

  if (error && !studentId) {
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
            CareerDisha&apos;s recommendations match real-world choices — improving guidance
            for future students.
          </p>
          <p className="text-xs text-outline mt-6 font-body">— CareerDisha Team</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-brand-gradient text-white py-5">
        <div className="max-w-form-compact mx-auto px-4 text-center">
          <h1 className="font-heading text-xl font-bold">
            <span className="text-white">Career</span>
            <span className="text-secondary">Disha</span>
          </h1>
          <p className="text-white/60 text-sm mt-1 font-body">6-Month Follow-Up</p>
        </div>
      </header>

      <div className="max-w-form-compact mx-auto px-4 py-8 space-y-5">
        {/* Intro card */}
        <div className="sa-card">
          <p className="text-sm text-on-surface-variant leading-relaxed font-body">
            It&apos;s been 6 months since your child received their CareerDisha report.
            We&apos;d love to know — which stream did they choose? It takes less than a minute
            and helps us improve guidance for future students.
          </p>
        </div>

        {/* Stream selection */}
        <div className="sa-card">
          <p className="text-sm font-heading font-semibold text-on-surface mb-3">
            Which stream / course did your child choose? <span className="text-red-500">*</span>
          </p>
          <div className="space-y-2">
            {STREAM_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStream(opt.value)}
                className={`w-full text-left px-4 py-3 rounded transition-all ${
                  stream === opt.value
                    ? "bg-brand-gradient text-white"
                    : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                }`}
              >
                <span className="text-sm font-heading font-medium block">
                  {opt.label}
                </span>
                <span
                  className={`text-xs block mt-0.5 font-body ${
                    stream === opt.value ? "text-white/60" : "text-on-surface-variant"
                  }`}
                >
                  {opt.sub}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Career interest */}
        <div className="sa-card">
          <p className="text-sm font-heading font-semibold text-on-surface mb-2">
            What career is your child currently interested in?{" "}
            <span className="font-normal text-on-surface-variant font-body">(optional)</span>
          </p>
          <input
            type="text"
            value={careerInterest}
            onChange={(e) => setCareerInterest(e.target.value)}
            placeholder="e.g. Software engineer, Doctor, CA, Graphic designer..."
            className="sa-input"
          />
        </div>

        {error && (
          <div className="bg-red-50 rounded p-3 text-red-600 text-sm text-center font-body">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !stream}
          className="btn-gold w-full py-3.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting..." : "Submit Response"}
        </button>

        <p className="text-center text-xs text-outline pb-4 font-body">
          Your response is used only for improving CareerDisha&apos;s recommendations.
        </p>
      </div>
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
