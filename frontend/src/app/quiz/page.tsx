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

  const scrollToFirstUnanswered = () => {
    if (!questions) return;
    for (const q of questions) {
      if (answers[String(q.id)] === undefined) {
        const el = document.getElementById(`quiz-q-${q.id}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
  };

  const handleSubmit = async () => {
    if (!allAnswered) { scrollToFirstUnanswered(); return; }
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
        <header className="fixed top-0 w-full z-50 flex justify-between items-center px-8 h-16 bg-brand-gradient">
          <div className="text-2xl font-bold text-white tracking-tight font-heading">CareerDisha</div>
          <div className="hidden md:flex space-x-8 items-center">
            <a className="text-secondary border-b-2 border-secondary pb-1 font-semibold text-sm" href="#">Tests</a>
          </div>
        </header>

        <main className="pt-24 pb-16 px-4 md:px-0">
          <div className="max-w-public mx-auto space-y-12">
            {/* Hero Header Section */}
            <section className="text-center space-y-4">
              <span className="inline-block py-1 px-3 bg-primary-100 text-primary text-xs font-bold rounded-full uppercase tracking-widest">
                Assessment Completed
              </span>
              <h1 className="text-4xl font-heading font-extrabold text-primary leading-tight">
                Your Stream Prediction Results
              </h1>
              <p className="text-on-surface-variant max-w-md mx-auto">
                Based on your scientific analysis of interests, strengths, and career aspirations.
              </p>
            </section>

            {/* Holland Code Card */}
            <div className="bg-white p-8 rounded shadow-sm flex flex-col items-center">
              <h3 className="text-xs font-bold uppercase tracking-widest text-outline mb-6">
                Primary Holland Code
              </h3>
              <div className="flex gap-4 mb-6">
                {result.holland_code.split("").map((letter, i) => (
                  <div
                    key={i}
                    className="w-20 h-20 flex items-center justify-center rounded-lg shadow-inner"
                    style={{ backgroundColor: RIASEC_COLORS[letter] || "#888" }}
                  >
                    <span className="text-4xl font-extrabold text-white font-heading">{letter}</span>
                  </div>
                ))}
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-primary font-heading">
                  {result.holland_code
                    .split("")
                    .map((l) => RIASEC_LABELS[l] || l)
                    .join(" / ")}
                </p>
                <p className="text-sm text-on-surface-variant mt-2 font-medium">
                  {result.message}
                </p>
              </div>
            </div>

            {/* Stream Recommendation Card */}
            <div className="bg-white p-8 rounded shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-outline mb-1">
                    Recommended Stream
                  </h3>
                  <h2 className="text-3xl font-extrabold text-primary font-heading">
                    {result.recommended_stream}
                  </h2>
                </div>
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 ${
                    result.confidence === "High"
                      ? "bg-accent-50 text-accent-600 border border-accent/20"
                      : result.confidence === "Medium"
                      ? "bg-secondary-50 text-secondary-600 border border-secondary/20"
                      : "bg-surface-container-high text-on-surface-variant border border-outline-variant"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                  </svg>
                  {result.confidence} Confidence
                </span>
              </div>
              <p className="text-on-surface-variant leading-relaxed mb-6">
                {result.message}
              </p>
            </div>

            {/* RIASEC Bar Chart Card */}
            <div className="bg-white p-8 rounded shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold text-primary font-heading">Your Interest Profile</h3>
                <span className="text-xs font-bold text-outline uppercase tracking-widest">RIASEC Framework</span>
              </div>
              <RiasecBarChart scores={result.riasec_scores} />
            </div>

            {/* Upgrade CTA Card */}
            <div className="bg-brand-gradient p-1 rounded-xl shadow-xl">
              <div className="bg-primary/40 p-8 rounded-lg border-2 border-secondary/30 backdrop-blur-sm">
                <div className="flex flex-col md:flex-row gap-8 items-center">
                  <div className="flex-1 space-y-4 text-center md:text-left">
                    <h2 className="text-2xl font-bold text-white font-heading">Want a detailed career roadmap?</h2>
                    <p className="text-slate-200 text-sm">
                      Get a 25-page comprehensive report covering sub-stream choices, college recommendations, and a 5-year skill roadmap.
                    </p>
                    <div className="flex flex-col gap-3">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-white/10 border-none rounded text-white placeholder:text-slate-400 focus:ring-2 focus:ring-secondary py-3 px-4"
                        placeholder="Email Address"
                      />
                      <input
                        type="tel"
                        value={parentPhone}
                        onChange={(e) => setParentPhone(e.target.value)}
                        className="w-full bg-white/10 border-none rounded text-white placeholder:text-slate-400 focus:ring-2 focus:ring-secondary py-3 px-4"
                        placeholder="Phone Number"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-4">
                    <div className="bg-white p-6 rounded text-center w-full md:w-64 border-t-4 border-secondary">
                      <p className="text-xs font-bold text-outline mb-1 uppercase">Limited Offer</p>
                      <p className="text-3xl font-extrabold text-primary mb-4 font-heading">{"\u20B9"}499</p>
                      <a
                        href={result.lead_id ? `/assessment?lead=${result.lead_id}` : "/assessment"}
                        className="block w-full py-4 px-6 rounded-lg bg-gold-gradient text-primary font-bold text-sm shadow-lg hover:translate-y-[-2px] transition-transform active:scale-95 text-center"
                      >
                        Get Your Full Career Report
                      </a>
                      <p className="text-[10px] text-outline mt-3 flex items-center justify-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
                        Secure Payment
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Phone capture for results */}
            {!showPhoneCapture && !phoneSaved && (
              <div className="text-center">
                <button
                  onClick={() => setShowPhoneCapture(true)}
                  className="text-on-surface-variant text-xs underline hover:text-on-surface transition-colors"
                >
                  Enter your number to receive program details
                </button>
              </div>
            )}

            {showPhoneCapture && !phoneSaved && (
              <div className="max-w-sm mx-auto flex flex-col gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="sa-input"
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="tel"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    placeholder="WhatsApp number"
                    className="sa-input flex-1"
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
              <p className="text-center text-on-surface-variant text-sm">
                We will reach out to you on WhatsApp shortly.
              </p>
            )}

            {/* Retake */}
            <div className="text-center pt-8">
              <button
                onClick={handleRetake}
                className="text-primary font-bold text-sm hover:underline flex items-center justify-center gap-2 transition-all mx-auto"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retake Quiz
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Quiz form
  return (
    <div className="min-h-screen bg-surface font-body">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-brand-gradient shadow-sm">
        <div className="flex justify-between items-center px-6 py-4 max-w-public mx-auto w-full">
          <div className="flex flex-col">
            <span className="text-xl font-bold text-white tracking-widest uppercase font-heading">CareerDisha</span>
            <span className="font-heading font-semibold text-sm tracking-tight text-secondary">Free Stream Predictor Quiz</span>
          </div>
          <div className="hidden md:flex flex-col items-end gap-2 w-1/3">
            <div className="flex justify-between w-full mb-1">
              <span className="text-[10px] text-slate-300 font-semibold tracking-wider uppercase">Current Progress</span>
              <span className="text-[10px] text-white font-bold">{answeredCount} of {totalQuestions} answered</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${(answeredCount / Math.max(totalQuestions, 1)) * 100}%`,
                  background: "linear-gradient(90deg, #d4ac0d, #27ae60)",
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a className="text-secondary font-bold text-sm border-b-2 border-secondary pb-1 font-heading" href="#">
              Quiz Dashboard
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-public mx-auto px-4 pt-12 pb-40 space-y-12">
        {/* Intro Card */}
        <section className="bg-surface-container-high p-8 rounded-lg shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <svg className="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
            <h2 className="font-heading font-semibold text-xl text-primary">Instructions</h2>
          </div>
          <p className="text-on-surface-variant font-medium leading-relaxed">
            To provide an accurate stream recommendation, please rate each statement based on how much you agree with it.
            <span className="block mt-2 text-sm italic opacity-75">Rate each statement from Strongly Disagree to Strongly Agree.</span>
          </p>
        </section>

        {/* Optional name field */}
        <div className="bg-white p-8 rounded-lg">
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
        <div className="space-y-8">
          {(questions || []).map((q, idx) => {
            const selected = answers[String(q.id)];
            const isAnswered = selected !== undefined;
            return (
              <article
                key={q.id}
                id={`quiz-q-${q.id}`}
                className={`p-8 rounded-lg transition-all duration-300 ${
                  isAnswered
                    ? "bg-white"
                    : idx === answeredCount
                    ? "bg-white ring-2 ring-primary/30"
                    : "bg-surface-container-high/50 opacity-90"
                }`}
              >
                <div className="flex items-start gap-6 mb-8">
                  <div
                    className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-heading font-bold text-lg ${
                      isAnswered
                        ? "bg-primary text-white"
                        : idx === answeredCount
                        ? "bg-primary text-white"
                        : "bg-surface-container-highest text-primary"
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div className="space-y-2">
                    <h3
                      className={`font-heading font-semibold text-xl leading-tight ${
                        isAnswered || idx === answeredCount
                          ? "text-primary"
                          : "text-on-surface-variant"
                      }`}
                    >
                      {q.text}
                    </h3>
                    <p
                      className={`text-lg text-on-surface-variant leading-snug ${
                        isAnswered || idx === answeredCount ? "opacity-80" : "opacity-60"
                      }`}
                    >
                      {q.text_hi}
                    </p>
                  </div>
                </div>

                {/* Rating buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  {SCALE_LABELS.map((label, i) => {
                    const score = i + 1;
                    const isSelected = selected === score;
                    return (
                      <button
                        key={score}
                        onClick={() => handleAnswer(q.id, score)}
                        className={`p-4 rounded text-xs font-bold transition-colors duration-200 uppercase tracking-tighter ${
                          isSelected
                            ? "bg-brand-gradient text-white ring-2 ring-primary-200"
                            : "bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-600 text-sm text-center p-6 rounded-lg">
            {error}
          </div>
        )}
      </main>

      {/* Fixed Bottom Bar */}
      <section className="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.05)] py-6 px-4 z-40">
        <div className="max-w-public mx-auto flex flex-col md:flex-row items-center gap-6">
          <div className="w-full md:flex-1">
            <label className="block text-[10px] font-bold text-primary uppercase tracking-widest mb-2" htmlFor="phone">
              WhatsApp for Results
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-semibold">+91</span>
              <input
                id="phone"
                type="tel"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="Enter Phone Number"
                className="w-full pl-14 pr-4 py-3 bg-surface-container-high rounded-lg focus:ring-2 focus:ring-primary focus:outline-none transition-all font-semibold placeholder:text-outline-variant"
              />
            </div>
          </div>
          <button
            onClick={allAnswered ? handleSubmit : scrollToFirstUnanswered}
            disabled={submitting}
            className={`w-full md:w-auto px-8 py-4 rounded-lg font-heading font-bold text-sm tracking-wide whitespace-nowrap shadow-lg flex items-center justify-center gap-3 transition-all duration-200 ${
              allAnswered
                ? "bg-primary text-white hover:brightness-110 cursor-pointer"
                : "bg-primary opacity-50 cursor-pointer text-white"
            }`}
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyzing your interests...
              </span>
            ) : (
              <>
                See My Stream Recommendation
                {!allAnswered && (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                  </svg>
                )}
              </>
            )}
          </button>
        </div>
        <p className="text-center mt-3 text-[10px] text-on-surface-variant font-medium opacity-60">
          Please answer all {totalQuestions} questions to unlock your personalized career report.
        </p>
      </section>

      {/* Footer */}
      <footer className="w-full py-8 border-t border-slate-200 bg-surface mb-32">
        <div className="flex flex-col md:flex-row justify-between items-center px-8 max-w-public mx-auto w-full gap-4">
          <span className="text-lg font-bold text-primary font-heading">CareerDisha</span>
          <div className="flex gap-6">
            <a className="text-xs text-slate-500 hover:text-secondary transition-colors duration-200" href="#">Contact Us</a>
            <a className="text-xs text-slate-500 hover:text-secondary transition-colors duration-200" href="#">Privacy Policy</a>
            <a className="text-xs text-slate-500 hover:text-secondary transition-colors duration-200" href="#">Terms of Service</a>
          </div>
          <p className="text-xs text-primary">&copy; {new Date().getFullYear()} CareerDisha. All rights reserved. DPDPA Compliant.</p>
        </div>
      </footer>
    </div>
  );
}
