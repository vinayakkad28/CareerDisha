"use client";

import { useState, useEffect } from "react";

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
          <p className="text-white/70 text-sm">Loading quiz...</p>
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
          <p className="text-white/70 text-sm">Loading questions...</p>
          {error && <p className="text-red-300 text-sm mt-2">{error}</p>}
        </div>
      </div>
    );
  }

  // Results page
  if (result) {
    const maxScore = Math.max(...Object.values(result.riasec_scores), 1);
    return (
      <div className="min-h-screen bg-[#f8f9fa]">
        {/* Header */}
        <header className="bg-brand-gradient text-white py-6">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-white">Career</span>
              <span style={{ color: "#d4ac0d" }}>Disha</span>
            </h1>
            <p className="text-white/60 text-sm mt-1">Your Stream Prediction Results</p>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          {/* Holland Code Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">
              Your Holland Code
            </p>
            <div className="flex justify-center gap-2 mb-4">
              {result.holland_code.split("").map((letter, i) => (
                <span
                  key={i}
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-sm"
                  style={{ backgroundColor: RIASEC_COLORS[letter] || "#888" }}
                >
                  {letter}
                </span>
              ))}
            </div>
            <p className="text-gray-500 text-sm">
              {result.holland_code
                .split("")
                .map((l) => RIASEC_LABELS[l] || l)
                .join(" / ")}
            </p>
          </div>

          {/* Stream Recommendation */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="text-center mb-4">
              <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">
                Recommended Stream
              </p>
              <h2
                className="text-2xl font-bold"
                style={{ color: "#1a5276" }}
              >
                {result.recommended_stream}
              </h2>
              <span
                className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${
                  result.confidence === "High"
                    ? "bg-green-100 text-green-700"
                    : result.confidence === "Medium"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                Confidence: {result.confidence}
              </span>
            </div>
            <p className="text-gray-600 text-sm text-center leading-relaxed">
              {result.message}
            </p>
          </div>

          {/* RIASEC Bar Chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-4 text-center">
              Your Interest Profile
            </p>
            <div className="space-y-3">
              {"RIASEC".split("").map((type) => {
                const score = result.riasec_scores[type] || 0;
                const widthPct = maxScore > 0 ? (score / maxScore) * 100 : 0;
                return (
                  <div key={type} className="flex items-center gap-3">
                    <div className="w-28 sm:w-32 flex items-center gap-2 shrink-0">
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: RIASEC_COLORS[type] }}
                      >
                        {type}
                      </span>
                      <span className="text-xs text-gray-500 truncate">
                        {RIASEC_LABELS[type]}
                      </span>
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: RIASEC_COLORS[type],
                          minWidth: score > 0 ? "8px" : "0px",
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 w-12 text-right tabular-nums">
                      {score}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTA Card */}
          <div
            className="rounded-2xl p-6 text-center text-white"
            style={{
              background: "linear-gradient(135deg, #1a5276 0%, #0d2b3e 100%)",
            }}
          >
            <h3 className="text-lg font-bold mb-2">
              Want a detailed career roadmap?
            </h3>
            <p className="text-white/70 text-sm mb-4">
              Get your full CareerDisha report with career recommendations,
              college suggestions, and a personalized action plan.
            </p>
            <a
              href={result.lead_id ? `/assessment?lead=${result.lead_id}` : "/assessment"}
              className="inline-block px-6 py-3 rounded-xl font-semibold text-sm transition-all
                hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background:
                  "linear-gradient(135deg, #d4ac0d 0%, #b8960b 100%)",
                color: "#1a5276",
              }}
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
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-gray-800 outline-none
                    focus:ring-2 focus:ring-[#d4ac0d]/50 placeholder:text-gray-400"
                />
                <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="tel"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="WhatsApp number"
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-800 outline-none
                    focus:ring-2 focus:ring-[#d4ac0d]/50 placeholder:text-gray-400"
                />
                <button
                  onClick={() => {
                    if (parentPhone.trim().length >= 10) {
                      setPhoneSaved(true);
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all
                    hover:shadow-md active:scale-[0.98]"
                  style={{
                    background:
                      "linear-gradient(135deg, #d4ac0d 0%, #b8960b 100%)",
                    color: "#1a5276",
                  }}
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
              className="text-sm text-gray-400 hover:text-gray-600 underline transition-colors"
            >
              Retake Quiz
            </button>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 pb-6">
            &copy; {new Date().getFullYear()} CareerDisha. Free stream predictor
            quiz.
          </p>
        </div>
      </div>
    );
  }

  // Quiz form
  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Header */}
      <header className="bg-brand-gradient text-white py-6 sticky top-0 z-20 shadow-lg">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-white">Career</span>
              <span style={{ color: "#d4ac0d" }}>Disha</span>
            </h1>
            <p className="text-white/60 text-sm mt-1">
              Free Stream Predictor Quiz
            </p>
          </div>
          {/* Progress bar */}
          <div className="mt-4 bg-white/10 rounded-full h-2 overflow-hidden">
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

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Intro */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm text-gray-600 leading-relaxed">
            Answer these 15 quick questions to discover which academic stream
            suits your interests. Rate each statement from{" "}
            <strong>Strongly Disagree</strong> to{" "}
            <strong>Strongly Agree</strong>.
          </p>
        </div>

        {/* Optional name field */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Your Name{" "}
            <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm
              focus:ring-2 focus:ring-[#1a5276]/20 focus:border-[#1a5276] outline-none
              transition-all bg-gray-50 focus:bg-white placeholder:text-gray-400"
          />
        </div>

        {/* Questions */}
        {(questions || []).map((q, idx) => {
          const selected = answers[String(q.id)];
          return (
            <div
              key={q.id}
              className={`bg-white rounded-2xl shadow-sm border p-5 transition-all ${
                selected
                  ? "border-[#1a5276]/20"
                  : "border-gray-100"
              }`}
            >
              <div className="flex gap-3 mb-3">
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                  style={{
                    backgroundColor: selected ? "#1a5276" : "#e5e7eb",
                    color: selected ? "white" : "#6b7280",
                  }}
                >
                  {idx + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-800 leading-snug">
                    {q.text}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{q.text_hi}</p>
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
                      className={`flex-1 py-2 px-1 rounded-xl text-center transition-all text-[10px] sm:text-xs leading-tight
                        ${
                          isSelected
                            ? "text-white shadow-sm font-semibold"
                            : "bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-100"
                        }`}
                      style={
                        isSelected
                          ? {
                              background:
                                "linear-gradient(135deg, #1a5276 0%, #0d2b3e 100%)",
                            }
                          : undefined
                      }
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
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-red-600 text-sm text-center">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="pt-2 pb-8">
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
            className="w-full py-3.5 text-white rounded-xl font-semibold text-sm
              transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed
              hover:shadow-lg hover:shadow-[#1a5276]/25 active:scale-[0.98]"
            style={{
              background: allAnswered
                ? "linear-gradient(135deg, #1a5276 0%, #0d2b3e 100%)"
                : undefined,
              backgroundColor: allAnswered ? undefined : "#9ca3af",
            }}
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
