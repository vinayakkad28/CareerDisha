"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const NAVY = "#1a5276";
const GOLD = "#d4ac0d";

function FeedbackForm() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get("sid");

  const [rating, setRating] = useState<number | null>(null);
  const [recommendationMatch, setRecommendationMatch] = useState<boolean | null>(null);
  const [mostUseful, setMostUseful] = useState("");
  const [missing, setMissing] = useState("");
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!studentId) setError("Invalid feedback link. Please use the link from your WhatsApp message.");
  }, [studentId]);

  const handleSubmit = async () => {
    if (!studentId) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/feedback/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: parseInt(studentId),
          token: studentId,
          rating,
          recommendation_match: recommendationMatch,
          most_useful: mostUseful,
          missing,
          would_recommend: wouldRecommend,
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
          <div className="text-5xl mb-4">🙏</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: NAVY }}>Thank You!</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            Your feedback helps us improve career guidance for thousands of students across India.
            We truly appreciate you taking the time.
          </p>
          <p className="text-xs text-gray-300 mt-6">— CareerDisha Team</p>
        </div>
      </div>
    );
  }

  const YesNo = ({
    value, onChange, yesLabel = "Yes", noLabel = "No",
  }: { value: boolean | null; onChange: (v: boolean) => void; yesLabel?: string; noLabel?: string }) => (
    <div className="flex gap-3">
      {[true, false].map((v) => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all"
          style={
            value === v
              ? { background: NAVY, color: "white", borderColor: NAVY }
              : { background: "#f9fafb", color: "#374151", borderColor: "#e5e7eb" }
          }
        >
          {v ? yesLabel : noLabel}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Header */}
      <header className="text-white py-5 shadow-lg" style={{ background: `linear-gradient(135deg, ${NAVY}, #0d2b3e)` }}>
        <div className="max-w-lg mx-auto px-4 text-center">
          <h1 className="text-xl font-bold">
            <span className="text-white">Career</span>
            <span style={{ color: GOLD }}>Disha</span>
          </h1>
          <p className="text-white/60 text-sm mt-1">Parent Feedback Survey</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm text-gray-500 leading-relaxed">
            Thank you for using CareerDisha. Your 2-minute feedback helps us improve guidance for students like yours.
          </p>
        </div>

        {/* Star rating */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">
            How would you rate the career report overall?
          </p>
          <div className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className="text-3xl transition-transform hover:scale-110"
                style={{ opacity: rating !== null && rating < star ? 0.3 : 1 }}
              >
                ★
              </button>
            ))}
          </div>
          {rating && (
            <p className="text-center text-xs text-gray-400 mt-2">
              {["", "Poor", "Below average", "Average", "Good", "Excellent"][rating]}
            </p>
          )}
        </div>

        {/* Recommendation match */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">
            Did the recommended career/stream match what you had in mind for your child?
          </p>
          <YesNo value={recommendationMatch} onChange={setRecommendationMatch} />
        </div>

        {/* Most useful */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-2">
            What was most useful in the report? <span className="font-normal text-gray-400">(optional)</span>
          </p>
          <textarea
            value={mostUseful}
            onChange={(e) => setMostUseful(e.target.value)}
            placeholder="e.g. The career pathways were very detailed and helpful"
            rows={3}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm
              focus:ring-2 focus:ring-[#1a5276]/20 focus:border-[#1a5276] outline-none
              resize-none bg-gray-50 focus:bg-white placeholder:text-gray-400"
          />
        </div>

        {/* Missing */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-2">
            What could be improved or was missing? <span className="font-normal text-gray-400">(optional)</span>
          </p>
          <textarea
            value={missing}
            onChange={(e) => setMissing(e.target.value)}
            placeholder="e.g. More information on entrance exam preparation"
            rows={3}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm
              focus:ring-2 focus:ring-[#1a5276]/20 focus:border-[#1a5276] outline-none
              resize-none bg-gray-50 focus:bg-white placeholder:text-gray-400"
          />
        </div>

        {/* Would recommend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">
            Would you recommend CareerDisha to other parents?
          </p>
          <YesNo
            value={wouldRecommend}
            onChange={setWouldRecommend}
            yesLabel="Yes, definitely"
            noLabel="Not really"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm text-center">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || rating === null}
          className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all
            hover:shadow-lg active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: `linear-gradient(135deg, ${GOLD}, #b8960b)`, color: NAVY }}
        >
          {submitting ? "Submitting…" : "Submit Feedback"}
        </button>

        <p className="text-center text-xs text-gray-400 pb-4">
          Your response is anonymous and used only to improve our service.
        </p>
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-gray-200 border-t-[#1a5276] rounded-full animate-spin" /></div>}>
      <FeedbackForm />
    </Suspense>
  );
}
