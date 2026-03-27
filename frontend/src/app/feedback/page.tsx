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
          <p className="text-xs text-outline mt-6 font-body">&mdash; CareerDisha Team</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-lg">
        <div className="flex justify-between items-center w-full max-w-public mx-auto px-6 h-16">
          <span className="text-2xl font-black text-primary font-heading">CareerDisha</span>
        </div>
      </header>

      <main className="max-w-form-compact mx-auto py-8 px-4 sm:px-0 flex flex-col gap-6">
        {/* Header Banner */}
        <div className="w-full bg-brand-gradient p-8 rounded-xl shadow-sm overflow-hidden relative">
          <div className="relative z-10">
            <h1 className="font-heading font-bold text-white text-3xl tracking-tight">CareerDisha</h1>
            <p className="font-heading text-white/90 text-lg font-medium mt-1">Parent Feedback Survey</p>
            <p className="text-white/70 text-sm mt-2 font-body italic">Building scientific career paths together</p>
          </div>
          <div className="absolute -right-10 -bottom-10 opacity-10">
            <svg className="w-40 h-40 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
            </svg>
          </div>
        </div>

        {/* Intro Card */}
        <section className="bg-white p-8 rounded-xl">
          <p className="text-on-surface-variant font-body text-lg leading-relaxed">
            Thank you for using CareerDisha. Your 2-minute feedback helps us improve guidance for students like yours.
          </p>
        </section>

        {/* Star Rating Card */}
        <section className="bg-white p-8 rounded-xl flex flex-col gap-4">
          <h2 className="font-heading font-semibold text-primary text-xl">How would you rate the career report overall?</h2>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className="transition-transform hover:scale-110"
              >
                <svg
                  className="w-10 h-10"
                  viewBox="0 0 24 24"
                  fill={rating !== null && rating >= star ? "#D4AC0D" : "#E1E3E4"}
                  stroke="none"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
            ))}
          </div>
          {rating && (
            <p className="font-body font-semibold text-primary uppercase text-xs tracking-widest mt-1">
              {STAR_LABELS[rating]}
            </p>
          )}
        </section>

        {/* Recommendation Match Card */}
        <section className="bg-white p-8 rounded-xl flex flex-col gap-6">
          <h2 className="font-heading font-semibold text-primary text-xl">
            Did the recommended career/stream match what you had in mind for your child?
          </h2>
          <div className="flex gap-4">
            <button
              onClick={() => setRecommendationMatch(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-body font-semibold transition-all active:scale-[0.98] ${
                recommendationMatch === true
                  ? "bg-primary text-white"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              {recommendationMatch === true && (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                </svg>
              )}
              Yes
            </button>
            <button
              onClick={() => setRecommendationMatch(false)}
              className={`flex-1 py-4 rounded-xl font-body font-semibold transition-all active:scale-[0.98] ${
                recommendationMatch === false
                  ? "bg-primary text-white"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              No
            </button>
          </div>
        </section>

        {/* Most Useful Textarea Card */}
        <section className="bg-white p-8 rounded-xl flex flex-col gap-4">
          <label className="font-heading font-semibold text-primary text-xl">
            What was most useful in the report? <span className="text-on-surface-variant font-normal text-sm">(optional)</span>
          </label>
          <textarea
            value={mostUseful}
            onChange={(e) => setMostUseful(e.target.value)}
            className="w-full h-32 bg-surface-container-high border-none rounded-xl p-4 font-body text-on-surface focus:ring-2 focus:ring-primary focus:bg-white transition-all placeholder:text-on-surface-variant/50 outline-none resize-none"
            placeholder="Share your thoughts on specific sections or insights..."
          />
        </section>

        {/* Missing Textarea Card */}
        <section className="bg-white p-8 rounded-xl flex flex-col gap-4">
          <label className="font-heading font-semibold text-primary text-xl">
            What could be improved or was missing? <span className="text-on-surface-variant font-normal text-sm">(optional)</span>
          </label>
          <textarea
            value={missing}
            onChange={(e) => setMissing(e.target.value)}
            className="w-full h-32 bg-surface-container-high border-none rounded-xl p-4 font-body text-on-surface focus:ring-2 focus:ring-primary focus:bg-white transition-all placeholder:text-on-surface-variant/50 outline-none resize-none"
            placeholder="Help us identify gaps or areas for clarification..."
          />
        </section>

        {/* Would Recommend Card */}
        <section className="bg-white p-8 rounded-xl flex flex-col gap-6">
          <h2 className="font-heading font-semibold text-primary text-xl">Would you recommend CareerDisha to other parents?</h2>
          <div className="flex gap-4">
            <button
              onClick={() => setWouldRecommend(true)}
              className={`flex-1 py-4 rounded-xl font-body font-semibold transition-all active:scale-[0.98] ${
                wouldRecommend === true
                  ? "bg-primary text-white"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              Yes, definitely
            </button>
            <button
              onClick={() => setWouldRecommend(false)}
              className={`flex-1 py-4 rounded-xl font-body font-semibold transition-all active:scale-[0.98] ${
                wouldRecommend === false
                  ? "bg-primary text-white"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              Not really
            </button>
          </div>
        </section>

        {error && (
          <div className="bg-red-50 rounded p-3 text-red-600 text-sm text-center font-body">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <div className="mt-4">
          <button
            onClick={handleSubmit}
            disabled={submitting || rating === null}
            className="w-full py-5 bg-gold-gradient text-white rounded-xl font-heading font-extrabold text-xl shadow-lg transition-all hover:shadow-xl active:scale-[0.99] flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting..." : "Submit Feedback"}
            {!submitting && (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h14" />
              </svg>
            )}
          </button>
          <p className="text-center mt-6 text-xs text-slate-500 font-body leading-relaxed max-w-[400px] mx-auto">
            Privacy Policy: Your feedback is confidential and used solely for quality improvement.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-50 w-full py-12 px-4 flex flex-col items-center gap-4 text-center mt-12">
        <div className="font-heading font-bold text-primary text-xl">CareerDisha</div>
        <p className="font-body text-xs text-slate-500 max-w-md">Scientific Career Counselling for Indian Students.</p>
        <div className="flex gap-6 mt-2">
          <span className="font-body text-xs text-slate-500 opacity-80">Privacy Policy</span>
          <span className="font-body text-xs text-slate-500 opacity-80">Terms of Service</span>
          <span className="font-body text-xs text-slate-500 opacity-80">Contact Us</span>
        </div>
      </footer>
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
