"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const STAR_LABELS = ["", "Poor", "Below average", "Average", "Good", "Excellent"];

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
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h2 className="font-heading text-xl font-bold text-primary mb-2">Thank You!</h2>
          <p className="text-on-surface-variant text-sm leading-relaxed font-body">
            Your feedback helps us improve career guidance for thousands of students across India.
            We truly appreciate you taking the time.
          </p>
          <p className="text-xs text-outline mt-6 font-body">— CareerDisha Team</p>
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
          className={`flex-1 py-2.5 rounded text-sm font-heading font-medium transition-all ${
            value === v
              ? "bg-brand-gradient text-white"
              : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
          }`}
        >
          {v ? yesLabel : noLabel}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-brand-gradient text-white py-5">
        <div className="max-w-form-compact mx-auto px-4 text-center">
          <h1 className="font-heading text-xl font-bold">
            <span className="text-white">Career</span>
            <span className="text-secondary">Disha</span>
          </h1>
          <p className="text-white/60 text-sm mt-1 font-body">Parent Feedback Survey</p>
        </div>
      </header>

      <div className="max-w-form-compact mx-auto px-4 py-8 space-y-5">
        {/* Intro */}
        <div className="sa-card">
          <p className="text-sm text-on-surface-variant leading-relaxed font-body">
            Thank you for using CareerDisha. Your 2-minute feedback helps us improve guidance for students like yours.
          </p>
        </div>

        {/* Star rating */}
        <div className="sa-card">
          <p className="text-sm font-heading font-semibold text-on-surface mb-4">
            How would you rate the career report overall?
          </p>
          <div className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className="text-3xl transition-transform hover:scale-110"
              >
                <svg
                  className="w-9 h-9"
                  viewBox="0 0 24 24"
                  fill={rating !== null && rating >= star ? "#d4ac0d" : "#f0f2f5"}
                  stroke={rating !== null && rating >= star ? "#d4ac0d" : "#c1c7cf"}
                  strokeWidth={1}
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
            ))}
          </div>
          {rating && (
            <p className="text-center text-xs text-on-surface-variant mt-2 font-body">
              {STAR_LABELS[rating]}
            </p>
          )}
        </div>

        {/* Recommendation match */}
        <div className="sa-card">
          <p className="text-sm font-heading font-semibold text-on-surface mb-3">
            Did the recommended career/stream match what you had in mind for your child?
          </p>
          <YesNo value={recommendationMatch} onChange={setRecommendationMatch} />
        </div>

        {/* Most useful */}
        <div className="sa-card">
          <p className="text-sm font-heading font-semibold text-on-surface mb-2">
            What was most useful in the report?{" "}
            <span className="font-normal text-on-surface-variant font-body">(optional)</span>
          </p>
          <textarea
            value={mostUseful}
            onChange={(e) => setMostUseful(e.target.value)}
            placeholder="e.g. The career pathways were very detailed and helpful"
            rows={3}
            className="sa-input resize-none"
          />
        </div>

        {/* Missing */}
        <div className="sa-card">
          <p className="text-sm font-heading font-semibold text-on-surface mb-2">
            What could be improved or was missing?{" "}
            <span className="font-normal text-on-surface-variant font-body">(optional)</span>
          </p>
          <textarea
            value={missing}
            onChange={(e) => setMissing(e.target.value)}
            placeholder="e.g. More information on entrance exam preparation"
            rows={3}
            className="sa-input resize-none"
          />
        </div>

        {/* Would recommend */}
        <div className="sa-card">
          <p className="text-sm font-heading font-semibold text-on-surface mb-3">
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
          <div className="bg-red-50 rounded p-3 text-red-600 text-sm text-center font-body">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || rating === null}
          className="btn-gold w-full py-3.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting..." : "Submit Feedback"}
        </button>

        <p className="text-center text-xs text-outline pb-4 font-body">
          Your response is anonymous and used only to improve our service.
        </p>
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-surface">
          <div className="w-8 h-8 border-4 border-surface-container-high border-t-primary rounded-full animate-spin" />
        </div>
      }
    >
      <FeedbackForm />
    </Suspense>
  );
}
