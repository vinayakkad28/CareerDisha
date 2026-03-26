"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const NAVY = "#1a5276";
const GOLD = "#d4ac0d";

const STREAM_OPTIONS = [
  { value: "Science (PCM)", label: "Science — PCM", sub: "Physics, Chemistry, Maths" },
  { value: "Science (PCB)", label: "Science — PCB", sub: "Physics, Chemistry, Biology" },
  { value: "Commerce", label: "Commerce", sub: "Accounts, Business Studies, Economics" },
  { value: "Arts/Humanities", label: "Arts / Humanities", sub: "History, Geography, Political Science…" },
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
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] px-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-gray-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: NAVY }}>Thank You!</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            Your response has been recorded. This helps us measure how accurately
            CareerDisha&apos;s recommendations match real-world choices — improving guidance
            for future students.
          </p>
          <p className="text-xs text-gray-300 mt-6">— CareerDisha Team</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Header */}
      <header className="text-white py-5 shadow-lg" style={{ background: `linear-gradient(135deg, ${NAVY}, #0d2b3e)` }}>
        <div className="max-w-lg mx-auto px-4 text-center">
          <h1 className="text-xl font-bold">
            <span className="text-white">Career</span>
            <span style={{ color: GOLD }}>Disha</span>
          </h1>
          <p className="text-white/60 text-sm mt-1">6-Month Follow-Up</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm text-gray-600 leading-relaxed">
            It&apos;s been 6 months since your child received their CareerDisha report.
            We&apos;d love to know — which stream did they choose? It takes less than a minute
            and helps us improve guidance for future students.
          </p>
        </div>

        {/* Stream selection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">
            Which stream / course did your child choose? <span className="text-red-400">*</span>
          </p>
          <div className="space-y-2">
            {STREAM_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStream(opt.value)}
                className="w-full text-left px-4 py-3 rounded-xl border transition-all"
                style={
                  stream === opt.value
                    ? { background: NAVY, borderColor: NAVY, color: "white" }
                    : { background: "#f9fafb", borderColor: "#e5e7eb", color: "#374151" }
                }
              >
                <span className="text-sm font-medium block">{opt.label}</span>
                <span
                  className="text-xs block mt-0.5"
                  style={{ color: stream === opt.value ? "rgba(255,255,255,0.6)" : "#9ca3af" }}
                >
                  {opt.sub}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Career interest */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-2">
            What career is your child currently interested in?{" "}
            <span className="font-normal text-gray-400">(optional)</span>
          </p>
          <input
            type="text"
            value={careerInterest}
            onChange={(e) => setCareerInterest(e.target.value)}
            placeholder="e.g. Software engineer, Doctor, CA, Graphic designer…"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm
              focus:ring-2 focus:ring-[#1a5276]/20 focus:border-[#1a5276] outline-none
              bg-gray-50 focus:bg-white placeholder:text-gray-400"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm text-center">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !stream}
          className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all
            hover:shadow-lg active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: `linear-gradient(135deg, ${GOLD}, #b8960b)`, color: NAVY }}
        >
          {submitting ? "Submitting…" : "Submit Response"}
        </button>

        <p className="text-center text-xs text-gray-400 pb-4">
          Your response is used only for improving CareerDisha&apos;s recommendations.
        </p>
      </div>
    </div>
  );
}

export default function OutcomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-gray-200 border-t-[#1a5276] rounded-full animate-spin" /></div>}>
      <OutcomeForm />
    </Suspense>
  );
}
