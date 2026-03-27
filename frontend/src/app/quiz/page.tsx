"use client";

import { useState, useEffect } from "react";
import { RiasecBarChart } from "@/components/RiasecRadarChart";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/api\/?$/, "");

const SCALE_LABELS = [
  "Strongly Disagree",
  "Disagree",
  "Neutral",
  "Agree",
  "Strongly Agree",
];

const RIASEC_LABELS: Record<string, string> = {
  R: "Realistic",
  I: "Investigative",
  A: "Artistic",
  S: "Social",
  E: "Enterprising",
  C: "Conventional",
};

const RIASEC_COLORS: Record<string, string> = {
  R: "#e74c3c",
  I: "#3498db",
  A: "#9b59b6",
  S: "#2ecc71",
  E: "#e67e22",
  C: "#1abc9c",
};

interface Question {
  id: number;
  text: string;
  text_hi: string;
  type: string;
}

interface QuizResult {
  holland_code: string;
  riasec_scores: Record<string, number>;
  recommended_stream: string;
  confidence: string;
  primary_type: string;
  message: string;
  cta: string;
  cta_url: string;
  lead_id?: string;
}

export default function QuizPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [studentName, setStudentName] = useState("");
  const [email, setEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [showPhoneCapture, setShowPhoneCapture] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    fetch(`${API_BASE}/api/quiz/questions`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        clearTimeout(timeoutId);
        setQuestions(data.questions);
        setLoading(false);
      })
      .catch((e) => {
        clearTimeout(timeoutId);
        setError(
          e?.name === "AbortError"
            ? "Loading timed out. Please check your connection and refresh."
            : "Failed to load quiz questions. Please refresh the page."
        );
        setLoading(false);
      });
    return () => { clearTimeout(timeoutId); controller.abort(); };
  }, []);

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = questions?.length || 0;
  const allAnswered = answeredCount === totalQuestions && totalQuestions > 0;

  const handleAnswer = (questionId: number, score: number) => {
    setAnswers((prev) => ({ ...prev, [String(questionId)]: score }));
  };

  const handleSubmit = async () => {
    if (!allAnswered) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/quiz/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          student_name: studentName,
          parent_phone: parentPhone,
          class_level: 10,
        }),
      });
      if (!res.ok) throw new Error("Submit failed");
      const data = await res.json();
      setResult(data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetake = () => {
    setResult(null);
    setAnswers({});
    setShowPhoneCapture(false);
    setPhoneSaved(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-gradient">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/70 font-body text-sm">Loading quiz...</p>
        </div>
      </div>
    );
  }

  // Guard: questions not loaded yet
  if (!questions || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-gradient">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/70 font-body text-sm">Loading questions...</p>
          {error && <p className="text-red-300 font-body text-sm mt-2">{error}</p>}
        </div>
      </div>
    );
  }

  // Results page
  if (result) {
    return (
      <div className="min-h-screen bg-surface font-body">
        {/* Header */}
        <header className="bg-brand-gradient text-white py-6">
          <div className="max-w-public mx-auto px-4 text-center">
            <h1 className="text-2xl font-heading font-bold tracking-tight">
              <span className="text-white">Career</span>
              <span className="text-secondary">Disha</span>
            </h1>
            <p className="text-white/60 text-sm mt-1">Your Stream Prediction Results</p>
          </div>
        </header>

        <div className="max-w-public mx-auto px-4 py-8 space-y-6">
          {/* Holland Code Card */}
          <div className="sa-card text-center">
            <p className="text-xs font-heading uppercase tracking-widest text-on-surface-variant mb-2">
              Your Holland Code
            </p>
            <div className="flex justify-center gap-2 mb-4">
              {result.holland_code.split("").map((letter, i) => (
                <span
                  key={i}
                  className="w-12 h-12 rounded flex items-center justify-center text-white text-lg font-heading font-bold"
                  style={{ backgroundColor: RIASEC_COLORS[letter] || "#888" }}
                >
                  {letter}
                </span>
              ))}
            </div>
            <p className="text-on-surface-variant text-sm">
              {result.holland_code
                .split("")
                .map((l) => RIASEC_LABELS[l] || l)
                .join(" / ")}
            </p>
          </div>

          {/* Stream Recommendation */}
          <div className="sa-card">
            <div className="text-center mb-4">
              <p className="text-xs font-heading uppercase tracking-widest text-on-surface-variant mb-2">
                Recommended Stream
              </p>
              <h2 className="text-2xl font-heading font-bold text-primary">
                {result.recommended_stream}
              </h2>
              <span
                className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${
                  result.confidence === "High"
                    ? "bg-accent-100 text-accent-600"
                    : result.confidence === "Medium"
                    ? "bg-secondary-100 text-secondary-600"
                    : "bg-surface-container-high text-on-surface-variant"
                }`}
              >
                Confidence: {result.confidence}
              </span>
            </div>
            <p className="text-on-surface-variant text-sm text-center leading-relaxed">
              {result.message}
            </p>
          </div>

          {/* RIASEC Bar Chart */}
          <div className="sa-card">
            <p className="text-xs font-heading uppercase tracking-widest text-on-surface-variant mb-4 text-center">
              Your Interest Profile
            </p>
            <RiasecBarChart scores={result.riasec_scores} />
          </div>

          {/* CTA Card */}
          <div className="sa-card bg-brand-gradient text-center text-white">
            <h3 className="text-lg font-heading font-bold mb-2">
              Want a detailed career roadmap?
            </h3>
            <p className="text-white/70 text-sm mb-4">
              Get your full CareerDisha report with career recommendations,
              college suggestions, and a personalized action plan.
            </p>
            <a
              href={result.lead_id ? `/assessment?lead=${result.lead_id}` : "/assessment"}
              className="btn-gold inline-flex py-3 px-6 text-sm font-bold"
            >
              Get Your Full 74-Question Career Report — ₹499
            </a>

            {/* Phone capture toggle */}
            {!showPhoneCapture && !phoneSaved && (
              <button
                onClick={() => setShowPhoneCapture(true)}
                className="block mx-auto mt-4 text-white/60 text-xs underline hover:text-white/80 transition-colors"
              >
                Enter your number to receive program details
              </button>
            )}

            {showPhoneCapture && !phoneSaved && (
              <div className="mt-4 flex flex-col gap-2 max-w-sm mx-auto">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="sa-input bg-white/10 text-white placeholder:text-white/40 border-white/20 focus:border-secondary"
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="tel"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    placeholder="WhatsApp number"
                    className="sa-input flex-1 bg-white/10 text-white placeholder:text-white/40 border-white/20 focus:border-secondary"
                  />
                  <button
                    onClick={() => {
                      if (parentPhone.trim().length >= 10) {
                        setPhoneSaved(true);
                      }
                    }}
                    className="btn-gold py-2.5 px-5 text-sm font-bold"
                  >
                    Send Details
                  </button>
                </div>
              </div>
            )}

            {phoneSaved && (
              <p className="mt-4 text-white/70 text-sm">
                We will reach out to you on WhatsApp shortly.
              </p>
            )}
          </div>

          {/* Retake */}
          <div className="text-center">
            <button
              onClick={handleRetake}
              className="text-sm text-on-surface-variant hover:text-on-surface underline transition-colors"
            >
              Retake Quiz
            </button>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-on-surface-variant pb-6">
            &copy; {new Date().getFullYear()} CareerDisha. Free stream predictor
            quiz.
          </p>
        </div>
      </div>
    );
  }

  // Quiz form
  return (
    <div className="min-h-screen bg-surface font-body">
      {/* Sticky Header */}
      <header className="bg-brand-gradient text-white py-5 sticky top-0 z-20">
        <div className="max-w-public mx-auto px-4">
          <div className="text-center">
            <h1 className="text-2xl font-heading font-bold tracking-tight">
              <span className="text-white">Career</span>
              <span className="text-secondary">Disha</span>
            </h1>
            <p className="text-white/60 text-sm mt-1">
              Free Stream Predictor Quiz
            </p>
          </div>
          {/* Progress bar */}
          <div className="mt-4 bg-surface-container-high/20 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${(answeredCount / Math.max(totalQuestions, 1)) * 100}%`,
                background: "linear-gradient(90deg, #d4ac0d, #2ecc71)",
              }}
            />
          </div>
          <p className="text-white/50 text-xs mt-1.5 text-center">
            {answeredCount} of {totalQuestions} answered
          </p>
        </div>
      </header>

      <div className="max-w-public mx-auto px-4 py-6 space-y-4">
        {/* Intro */}
        <div className="sa-card">
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Answer these 15 quick questions to discover which academic stream
            suits your interests. Rate each statement from{" "}
            <strong className="text-on-surface">Strongly Disagree</strong> to{" "}
            <strong className="text-on-surface">Strongly Agree</strong>.
          </p>
        </div>

        {/* Optional name field */}
        <div className="sa-card">
          <label className="block text-sm font-heading font-semibold text-on-surface mb-1.5">
            Your Name{" "}
            <span className="text-on-surface-variant font-normal font-body">(optional)</span>
          </label>
          <input
            type="text"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="Enter your name"
            className="sa-input"
          />
        </div>

        {/* Questions */}
        {(questions || []).map((q, idx) => {
          const selected = answers[String(q.id)];
          return (
            <div
              key={q.id}
              className="sa-card transition-all animate-fade-in"
            >
              <div className="flex gap-3 mb-3">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-heading font-bold shrink-0 ${
                    selected
                      ? "bg-primary text-white"
                      : "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  {idx + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-on-surface leading-snug">
                    {q.text}
                  </p>
                  <p className="text-xs text-on-surface-variant/60 mt-0.5">{q.text_hi}</p>
                </div>
              </div>

              {/* Rating buttons */}
              <div className="flex gap-1.5 sm:gap-2 ml-10">
                {SCALE_LABELS.map((label, i) => {
                  const score = i + 1;
                  const isSelected = selected === score;
                  return (
                    <button
                      key={score}
                      onClick={() => handleAnswer(q.id, score)}
                      className={`flex-1 py-2 px-1 rounded text-center transition-all text-[10px] sm:text-xs leading-tight font-medium
                        ${
                          isSelected
                            ? "btn-primary !px-1 !py-2 !text-[10px] sm:!text-xs"
                            : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                        }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Error */}
        {error && (
          <div className="sa-card bg-red-50 text-red-600 text-sm text-center">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="pt-2 pb-8">
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
            className={`w-full py-3.5 rounded font-heading font-bold text-sm transition-all duration-200
              disabled:opacity-40 disabled:cursor-not-allowed
              ${allAnswered ? "btn-primary !w-full !py-3.5" : "bg-surface-container-highest text-on-surface-variant"}`}
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
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
                Analyzing your interests...
              </span>
            ) : allAnswered ? (
              "See My Stream Recommendation"
            ) : (
              `Answer all ${totalQuestions} questions to continue (${totalQuestions - answeredCount} remaining)`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
