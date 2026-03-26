"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"
).replace(/\/api$/, "");

/* ── brand tokens ─────────────────────────────────────────── */
const NAVY = "#1a5276";
const GOLD = "#d4ac0d";
const NAVY_DARK = "#0d2b3e";

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

const SCALE_LABELS = [
  "Strongly Disagree",
  "Disagree",
  "Neutral",
  "Agree",
  "Strongly Agree",
];

const SELF_EFFICACY_DOMAINS = [
  "Mathematics",
  "Science",
  "English",
  "Creative Arts",
  "Business / Commerce",
  "Social Service",
];

const CLASS_OPTIONS = ["9", "10", "11", "12"];
const GENDER_OPTIONS = ["Male", "Female", "Other"];
const INCOME_OPTIONS = ["Below ₹3L", "₹3-10L", "₹10-25L", "Above ₹25L"];
const LOCATION_OPTIONS = ["Metro", "Tier 2", "Rural"];
const PARENT_EDU_OPTIONS = ["Below 10th", "12th", "Graduate", "Postgrad"];

/* ── types ────────────────────────────────────────────────── */
interface Question {
  id: number;
  text: string;
  text_hi?: string;
  type?: string;
}

interface PreviewData {
  holland_code: string;
  riasec_scores: Record<string, number>;
  recommended_stream: string;
  confidence: string;
  career_teasers?: string[];
}

interface PaymentData {
  order_id: string;
  amount: number;
  currency: string;
  razorpay_key?: string;
}

/* ── helpers ──────────────────────────────────────────────── */
function cls(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ── component ────────────────────────────────────────────── */
export default function AssessmentPage() {
  const searchParams = useSearchParams();
  const leadId = searchParams.get("lead");

  /* state */
  const [step, setStep] = useState(1);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1
  const [studentName, setStudentName] = useState("");
  const [email, setEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [classLevel, setClassLevel] = useState("");

  // Step 2
  const [gender, setGender] = useState("");
  const [income, setIncome] = useState("");
  const [location, setLocation] = useState("");
  const [parentEdu, setParentEdu] = useState("");
  const [firstGen, setFirstGen] = useState(false);
  const [mathMarks, setMathMarks] = useState("");
  const [scienceMarks, setScienceMarks] = useState("");
  const [englishMarks, setEnglishMarks] = useState("");

  // Step 3
  const [selfEfficacy, setSelfEfficacy] = useState<Record<string, number>>({});

  // Step 4
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  // Step 5
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

  // Step 6
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);

  // Step 7
  const [reportStatus, setReportStatus] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── API helpers ─────────────────────────────────────────── */
  const apiPost = useCallback(
    async (path: string, body?: Record<string, unknown>) => {
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed (${res.status})`);
      }
      return res.json();
    },
    []
  );

  const apiGet = useCallback(async (path: string) => {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res.json();
  }, []);

  /* ── step handlers ──────────────────────────────────────── */

  // Step 1 → start assessment
  const handleStart = async () => {
    if (!studentName.trim()) {
      setError("Please enter your name.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await apiPost("/api/d2c/start", {
        student_name: studentName.trim(),
        email: email.trim() || undefined,
        parent_phone: parentPhone.trim() || undefined,
        class_level: classLevel || undefined,
        lead_id: leadId || undefined,
      });
      setToken(data.token);
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError(
        "Could not start assessment. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Step 2 → save context (optional)
  const handleContextContinue = async () => {
    setLoading(true);
    setError("");
    try {
      await apiPost(`/api/d2c/context/${token}`, {
        gender: gender || undefined,
        income_bracket: income || undefined,
        location: location || undefined,
        parental_education: parentEdu || undefined,
        first_gen_learner: firstGen,
        math_marks: mathMarks ? Number(mathMarks) : undefined,
        science_marks: scienceMarks ? Number(scienceMarks) : undefined,
        english_marks: englishMarks ? Number(englishMarks) : undefined,
      });
    } catch {
      // Context is optional — proceed even if save fails
    }
    setStep(3);
    setLoading(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleContextSkip = () => {
    setStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Step 3 → save self-efficacy + load questions
  const handleSelfEfficacyContinue = async () => {
    setLoading(true);
    setError("");
    try {
      await apiPost(`/api/d2c/self-efficacy/${token}`, {
        scores: selfEfficacy,
      });
    } catch {
      // Non-critical
    }

    // Load RIASEC questions
    setQuestionsLoading(true);
    try {
      const data = await apiGet("/api/d2c/questions");
      setQuestions(data.questions || []);
    } catch {
      setError("Failed to load assessment questions. Please try again.");
      setLoading(false);
      setQuestionsLoading(false);
      return;
    }
    setQuestionsLoading(false);
    setStep(4);
    setLoading(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Step 4 → submit assessment
  const handleSubmitAssessment = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiPost(`/api/d2c/submit/${token}`, {
        answers,
        self_efficacy: selfEfficacy,
        context: {
          gender,
          income_bracket: income,
          location,
          parental_education: parentEdu,
          first_gen_learner: firstGen,
          math_marks: mathMarks ? Number(mathMarks) : undefined,
          science_marks: scienceMarks ? Number(scienceMarks) : undefined,
          english_marks: englishMarks ? Number(englishMarks) : undefined,
        },
      });
      setPreviewData(data);
      setStep(5);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Submission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 5 → create order
  const handleUnlockReport = async (tier: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await apiPost(`/api/d2c/create-order/${token}`, { tier });
      setPaymentData(data);
      setStep(6);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Could not create order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Load Razorpay.js when we reach the payment step
  useEffect(() => {
    if (!paymentData) return;
    if (typeof window === "undefined") return;
    if ((window as unknown as Record<string, unknown>).Razorpay) return;
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.head.appendChild(script);
  }, [paymentData]);

  // Step 6 → payment
  const handlePayment = useCallback(async () => {
    if (!paymentData) return;

    // If Razorpay key present, open checkout
    if (paymentData.razorpay_key && typeof window !== "undefined") {
      const Razorpay = (window as unknown as Record<string, unknown>).Razorpay as
        | (new (opts: Record<string, unknown>) => { open: () => void })
        | undefined;
      if (Razorpay) {
        const rzp = new Razorpay({
          key: paymentData.razorpay_key,
          amount: paymentData.amount,
          currency: paymentData.currency || "INR",
          order_id: paymentData.order_id,
          name: "CareerDisha",
          description: "Career Assessment Report",
          handler: async (response: Record<string, string>) => {
            try {
              await apiPost(`/api/d2c/verify-payment/${token}`, {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              });
              setStep(7);
              window.scrollTo({ top: 0, behavior: "smooth" });
            } catch {
              setError("Payment verification failed. Please contact support.");
            }
          },
          theme: { color: NAVY },
        });
        rzp.open();
        return;
      }
    }

    // Mock mode
    handleMockPayment();
  }, [paymentData, token, apiPost]);

  const handleMockPayment = async () => {
    setLoading(true);
    setError("");
    try {
      await apiPost(`/api/d2c/verify-payment/${token}`, {
        razorpay_payment_id: "mock_pay_" + Date.now(),
        razorpay_order_id: paymentData?.order_id || "mock_order",
        razorpay_signature: "mock_signature",
      });
      setStep(7);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Payment simulation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 7 → poll status
  useEffect(() => {
    if (step !== 7) return;
    const poll = async () => {
      try {
        const data = await apiGet(`/api/d2c/status/${token}`);
        setReportStatus(data.status);
        if (data.status === "report_ready") {
          if (pollRef.current) clearInterval(pollRef.current);
          setStep(8);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } catch {
        // keep polling
      }
    };
    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [step, token, apiGet]);

  /* ── progress % ─────────────────────────────────────────── */
  const progressPct =
    step === 1
      ? 0
      : step === 2
      ? 10
      : step === 3
      ? 20
      : step === 4
      ? 20 + (Object.keys(answers).length / Math.max(questions.length, 1)) * 60
      : step === 5
      ? 85
      : step === 6
      ? 90
      : step === 7
      ? 95
      : 100;

  const totalQ = questions.length || 74;
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === totalQ && totalQ > 0;

  /* ── shared UI pieces ───────────────────────────────────── */
  const Logo = () => (
    <h1 className="text-2xl font-bold tracking-tight">
      <span className="text-white">Career</span>
      <span style={{ color: GOLD }}>Disha</span>
    </h1>
  );

  const Header = ({ subtitle }: { subtitle?: string }) => (
    <header className="bg-brand-gradient text-white py-5 shadow-lg">
      <div className="max-w-lg mx-auto px-4 text-center">
        <Logo />
        {subtitle && (
          <p className="text-white/60 text-sm mt-1">{subtitle}</p>
        )}
        {step >= 1 && step <= 7 && (
          <>
            <div className="mt-3 bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPct}%`,
                  background: `linear-gradient(90deg, ${GOLD}, #2ecc71)`,
                }}
              />
            </div>
            <p className="text-white/40 text-xs mt-1">
              Step {step} of 8
            </p>
          </>
        )}
      </div>
    </header>
  );

  const ErrorBanner = () =>
    error ? (
      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm text-center">
        {error}
      </div>
    ) : null;

  const PrimaryBtn = ({
    children,
    onClick,
    disabled,
    className: extra,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cls(
        "w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        "hover:shadow-lg active:scale-[0.98]",
        extra
      )}
      style={{
        background: `linear-gradient(135deg, ${GOLD} 0%, #b8960b 100%)`,
        color: NAVY,
      }}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
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
          Please wait...
        </span>
      ) : (
        children
      )}
    </button>
  );

  const Card = ({
    children,
    className: extra,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div
      className={cls(
        "bg-white rounded-2xl shadow-sm border border-gray-100 p-6",
        extra
      )}
    >
      {children}
    </div>
  );

  const OptionButtons = ({
    options,
    value,
    onChange,
  }: {
    options: string[];
    value: string;
    onChange: (v: string) => void;
  }) => (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cls(
            "px-4 py-2 rounded-xl text-sm font-medium transition-all border",
            value === opt
              ? "text-white border-transparent shadow-sm"
              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
          )}
          style={
            value === opt
              ? { background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_DARK} 100%)` }
              : undefined
          }
        >
          {opt}
        </button>
      ))}
    </div>
  );

  /* ═══════════════════════════════════════════════════════════
     STEP 1 — Landing / Info
     ═══════════════════════════════════════════════════════════ */
  if (step === 1) {
    return (
      <div className="min-h-screen bg-[#f8f9fa]">
        <Header />
        <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
          <Card>
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold" style={{ color: NAVY }}>
                AI Career Assessment
              </h2>
              <p className="text-gray-400 text-sm">
                एआई करियर मूल्यांकन
              </p>
              <p className="text-gray-600 text-sm mt-3 leading-relaxed">
                Discover your ideal career path in 20 minutes. Answer 74
                research-backed questions and get a personalized career report
                powered by AI.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Student Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm
                    focus:ring-2 focus:ring-[#1a5276]/20 focus:border-[#1a5276] outline-none
                    transition-all bg-gray-50 focus:bg-white placeholder:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm
                    focus:ring-2 focus:ring-[#1a5276]/20 focus:border-[#1a5276] outline-none
                    transition-all bg-gray-50 focus:bg-white placeholder:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent / Guardian Phone{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="WhatsApp number"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm
                    focus:ring-2 focus:ring-[#1a5276]/20 focus:border-[#1a5276] outline-none
                    transition-all bg-gray-50 focus:bg-white placeholder:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Class
                </label>
                <OptionButtons
                  options={CLASS_OPTIONS}
                  value={classLevel}
                  onChange={setClassLevel}
                />
              </div>
            </div>
          </Card>

          <ErrorBanner />
          <PrimaryBtn onClick={handleStart} disabled={!studentName.trim()}>
            Start Assessment
          </PrimaryBtn>

          <p className="text-center text-xs text-gray-400">
            Takes approximately 20 minutes &middot; 74 questions &middot; No
            login required
          </p>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     STEP 2 — Context (optional)
     ═══════════════════════════════════════════════════════════ */
  if (step === 2) {
    return (
      <div className="min-h-screen bg-[#f8f9fa]">
        <Header subtitle="Help us personalize your report" />
        <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
          <Card>
            <h3 className="text-lg font-bold mb-1" style={{ color: NAVY }}>
              Help us personalize your report
            </h3>
            <p className="text-gray-500 text-sm mb-5">
              This information is optional but helps us give more relevant
              recommendations.
            </p>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gender
                </label>
                <OptionButtons
                  options={GENDER_OPTIONS}
                  value={gender}
                  onChange={setGender}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Family Income Bracket
                </label>
                <OptionButtons
                  options={INCOME_OPTIONS}
                  value={income}
                  onChange={setIncome}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <OptionButtons
                  options={LOCATION_OPTIONS}
                  value={location}
                  onChange={setLocation}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Parental Education
                </label>
                <OptionButtons
                  options={PARENT_EDU_OPTIONS}
                  value={parentEdu}
                  onChange={setParentEdu}
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  First-generation learner?
                </label>
                <button
                  onClick={() => setFirstGen(!firstGen)}
                  className={cls(
                    "w-12 h-6 rounded-full transition-all relative",
                    firstGen ? "bg-green-500" : "bg-gray-300"
                  )}
                >
                  <span
                    className={cls(
                      "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all",
                      firstGen ? "left-6" : "left-0.5"
                    )}
                  />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Academic Marks{" "}
                  <span className="text-gray-400 font-normal">(optional %)</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Maths
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={mathMarks}
                      onChange={(e) => setMathMarks(e.target.value)}
                      placeholder="%"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm
                        focus:ring-2 focus:ring-[#1a5276]/20 focus:border-[#1a5276] outline-none
                        bg-gray-50 focus:bg-white placeholder:text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Science
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={scienceMarks}
                      onChange={(e) => setScienceMarks(e.target.value)}
                      placeholder="%"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm
                        focus:ring-2 focus:ring-[#1a5276]/20 focus:border-[#1a5276] outline-none
                        bg-gray-50 focus:bg-white placeholder:text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      English
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={englishMarks}
                      onChange={(e) => setEnglishMarks(e.target.value)}
                      placeholder="%"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm
                        focus:ring-2 focus:ring-[#1a5276]/20 focus:border-[#1a5276] outline-none
                        bg-gray-50 focus:bg-white placeholder:text-gray-400"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <ErrorBanner />
          <PrimaryBtn onClick={handleContextContinue}>Continue</PrimaryBtn>
          <div className="text-center">
            <button
              onClick={handleContextSkip}
              className="text-sm text-gray-400 hover:text-gray-600 underline transition-colors"
            >
              Skip this step
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     STEP 3 — Self-Efficacy
     ═══════════════════════════════════════════════════════════ */
  if (step === 3) {
    const seLabels = ["Not confident", "", "", "", "Very confident"];
    const allSEAnswered = Object.keys(selfEfficacy).length === 6;

    return (
      <div className="min-h-screen bg-[#f8f9fa]">
        <Header subtitle="How confident are you in these areas?" />
        <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
          <Card>
            <h3 className="text-lg font-bold mb-1" style={{ color: NAVY }}>
              Self-Confidence Check
            </h3>
            <p className="text-gray-500 text-sm mb-5">
              Rate your confidence in each area. This takes about 30 seconds.
            </p>

            <div className="space-y-5">
              {SELF_EFFICACY_DOMAINS.map((domain) => {
                const val = selfEfficacy[domain];
                return (
                  <div key={domain}>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      {domain}
                    </p>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          onClick={() =>
                            setSelfEfficacy((p) => ({ ...p, [domain]: score }))
                          }
                          className={cls(
                            "flex-1 py-2 rounded-xl text-center transition-all text-xs leading-tight border",
                            val === score
                              ? "text-white border-transparent shadow-sm font-semibold"
                              : "bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100"
                          )}
                          style={
                            val === score
                              ? {
                                  background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_DARK} 100%)`,
                                }
                              : undefined
                          }
                        >
                          {seLabels[score - 1] || score}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <ErrorBanner />
          <PrimaryBtn
            onClick={handleSelfEfficacyContinue}
            disabled={!allSEAnswered}
          >
            {questionsLoading ? "Loading questions..." : "Continue to Assessment"}
          </PrimaryBtn>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     STEP 4 — RIASEC Assessment (74 questions, one at a time)
     ═══════════════════════════════════════════════════════════ */
  if (step === 4) {
    if (!questions || questions.length === 0) {
      return (
        <div className="min-h-screen bg-[#f8f9fa]">
          <Header subtitle="Loading assessment..." />
          <div className="max-w-lg mx-auto px-4 py-16 text-center">
            <div className="w-10 h-10 border-3 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500 text-sm">Loading questions...</p>
            {error && (
              <p className="text-red-500 text-sm mt-2">{error}</p>
            )}
          </div>
        </div>
      );
    }

    const q = questions[currentQ];
    const selectedAnswer = q ? answers[String(q.id)] : undefined;

    return (
      <div className="min-h-screen bg-[#f8f9fa]">
        <header className="bg-brand-gradient text-white py-5 shadow-lg sticky top-0 z-20">
          <div className="max-w-lg mx-auto px-4 text-center">
            <Logo />
            <p className="text-white/60 text-sm mt-1">
              Question {currentQ + 1} of {totalQ}
            </p>
            <div className="mt-3 bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${((currentQ + 1) / totalQ) * 100}%`,
                  background: `linear-gradient(90deg, ${GOLD}, #2ecc71)`,
                }}
              />
            </div>
            <p className="text-white/40 text-xs mt-1">
              {answeredCount} answered
            </p>
          </div>
        </header>

        <div className="max-w-lg mx-auto px-4 py-8">
          <Card className="mb-6">
            <p className="text-base font-medium text-gray-800 leading-relaxed mb-1">
              {q?.text}
            </p>
            {q?.text_hi && (
              <p className="text-sm text-gray-400">{q.text_hi}</p>
            )}

            <div className="mt-6 space-y-2">
              {SCALE_LABELS.map((label, i) => {
                const score = i + 1;
                const isSelected = selectedAnswer === score;
                return (
                  <button
                    key={score}
                    onClick={() => {
                      if (q) {
                        setAnswers((prev) => ({
                          ...prev,
                          [String(q.id)]: score,
                        }));
                        // Auto-advance after short delay
                        setTimeout(() => {
                          if (currentQ < totalQ - 1) {
                            setCurrentQ((c) => c + 1);
                          }
                        }, 250);
                      }
                    }}
                    className={cls(
                      "w-full py-3 px-4 rounded-xl text-left text-sm font-medium transition-all border",
                      isSelected
                        ? "text-white border-transparent shadow-sm"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                    )}
                    style={
                      isSelected
                        ? {
                            background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_DARK} 100%)`,
                          }
                        : undefined
                    }
                  >
                    <span className="inline-block w-6">{score}.</span> {label}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Navigation */}
          <div className="flex gap-3">
            <button
              onClick={() => setCurrentQ((c) => Math.max(0, c - 1))}
              disabled={currentQ === 0}
              className="flex-1 py-3 rounded-xl text-sm font-medium border border-gray-200 text-gray-600
                hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            {currentQ < totalQ - 1 ? (
              <button
                onClick={() => setCurrentQ((c) => c + 1)}
                className="flex-1 py-3 rounded-xl text-sm font-medium border border-gray-200 text-gray-600
                  hover:bg-gray-100 transition-all"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmitAssessment}
                disabled={!allAnswered || loading}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white
                  disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                style={{
                  background: allAnswered
                    ? `linear-gradient(135deg, ${GOLD} 0%, #b8960b 100%)`
                    : "#9ca3af",
                  color: allAnswered ? NAVY : "white",
                }}
              >
                {loading ? "Submitting..." : "Submit Assessment"}
              </button>
            )}
          </div>

          <ErrorBanner />
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     STEP 5 — Preview Results
     ═══════════════════════════════════════════════════════════ */
  if (step === 5) {
    const pd = previewData;
    const maxScore = pd
      ? Math.max(...Object.values(pd.riasec_scores), 1)
      : 1;

    const PRICING = [
      {
        tier: "basic",
        name: "Basic",
        price: "₹499",
        features: [
          "Full RIASEC analysis",
          "Stream recommendation",
          "Top 5 career paths",
          "Basic college list",
        ],
        highlight: false,
      },
      {
        tier: "plus",
        name: "Plus",
        price: "₹1,999",
        features: [
          "Everything in Basic",
          "12-page detailed report",
          "College list with NIRF rankings",
          "Salary data & job outlook",
          "Personalized action plan",
        ],
        highlight: true,
      },
      {
        tier: "premium",
        name: "Premium",
        price: "₹2,999",
        features: [
          "Everything in Plus",
          "1-on-1 counsellor call (30 min)",
          "Parent guidance booklet",
          "WhatsApp support for 1 month",
          "Scholarship recommendations",
        ],
        highlight: false,
      },
    ];

    return (
      <div className="min-h-screen bg-[#f8f9fa]">
        <Header subtitle="Your Preview Results" />
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
          {/* Holland Code */}
          {pd && (
            <>
              <Card className="text-center">
                <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">
                  Your Holland Code
                </p>
                <div className="flex justify-center gap-2 mb-3">
                  {pd.holland_code.split("").map((letter, i) => (
                    <span
                      key={i}
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-sm"
                      style={{
                        backgroundColor: RIASEC_COLORS[letter] || "#888",
                      }}
                    >
                      {letter}
                    </span>
                  ))}
                </div>
                <p className="text-gray-500 text-sm">
                  {pd.holland_code
                    .split("")
                    .map((l) => RIASEC_LABELS[l] || l)
                    .join(" / ")}
                </p>
              </Card>

              {/* RIASEC bar chart */}
              <Card>
                <p className="text-xs uppercase tracking-widest text-gray-400 mb-4 text-center">
                  Your Interest Profile
                </p>
                <div className="space-y-3">
                  {"RIASEC".split("").map((type) => {
                    const score = pd.riasec_scores[type] || 0;
                    const widthPct =
                      maxScore > 0 ? (score / maxScore) * 100 : 0;
                    return (
                      <div key={type} className="flex items-center gap-3">
                        <div className="w-28 flex items-center gap-2 shrink-0">
                          <span
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{
                              backgroundColor: RIASEC_COLORS[type],
                            }}
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
              </Card>

              {/* Stream recommendation */}
              <Card className="text-center">
                <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">
                  Recommended Stream
                </p>
                <h2 className="text-2xl font-bold" style={{ color: NAVY }}>
                  {pd.recommended_stream}
                </h2>
                <span
                  className={cls(
                    "inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium",
                    pd.confidence === "High"
                      ? "bg-green-100 text-green-700"
                      : pd.confidence === "Medium"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-600"
                  )}
                >
                  Confidence: {pd.confidence}
                </span>
              </Card>

              {/* Career teasers */}
              {pd.career_teasers && pd.career_teasers.length > 0 && (
                <Card>
                  <p className="text-xs uppercase tracking-widest text-gray-400 mb-3 text-center">
                    Top Career Matches
                  </p>
                  <div className="space-y-2">
                    {pd.career_teasers.slice(0, 3).map((career, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl"
                      >
                        <span
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: GOLD }}
                        >
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-700">
                          {career}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}

          {/* Blurred/locked full report preview */}
          <Card className="relative overflow-hidden">
            <div className="filter blur-[2px] opacity-50 pointer-events-none select-none">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Detailed Career Pathways
              </p>
              <p className="text-xs text-gray-500 mb-1">
                Software Engineering - Expected salary: 8-25 LPA
              </p>
              <p className="text-xs text-gray-500 mb-1">
                Data Science - Expected salary: 6-20 LPA
              </p>
              <p className="text-xs text-gray-500 mb-3">
                Product Management - Expected salary: 10-30 LPA
              </p>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Recommended Colleges (NIRF 2024)
              </p>
              <p className="text-xs text-gray-500 mb-1">
                1. IIT Bombay - Rank #1
              </p>
              <p className="text-xs text-gray-500 mb-1">
                2. IIT Delhi - Rank #2
              </p>
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
              <div className="text-center px-4">
                <div className="text-3xl mb-2">🔒</div>
                <p
                  className="text-sm font-bold mb-2"
                  style={{ color: NAVY }}
                >
                  Your full 12-page report includes:
                </p>
                <ul className="text-xs text-gray-600 space-y-1 text-left inline-block">
                  <li>&#x2713; Detailed career pathways &amp; roadmaps</li>
                  <li>&#x2713; College lists with NIRF rankings</li>
                  <li>&#x2713; Salary data &amp; job market outlook</li>
                  <li>&#x2713; Personalized action plan</li>
                  <li>&#x2713; Parent guide &amp; next steps</li>
                </ul>
              </div>
            </div>
          </Card>

          {/* Pricing cards */}
          <div className="space-y-4">
            <h3
              className="text-lg font-bold text-center"
              style={{ color: NAVY }}
            >
              Unlock Your Full Report
            </h3>
            {PRICING.map((plan) => (
              <div
                key={plan.tier}
                className={cls(
                  "rounded-2xl border-2 p-5 transition-all",
                  plan.highlight
                    ? "border-[#d4ac0d] shadow-lg shadow-[#d4ac0d]/10 bg-white"
                    : "border-gray-200 bg-white"
                )}
              >
                {plan.highlight && (
                  <span
                    className="inline-block px-3 py-0.5 rounded-full text-xs font-bold mb-2 text-white"
                    style={{ backgroundColor: GOLD }}
                  >
                    MOST POPULAR
                  </span>
                )}
                <div className="flex items-baseline justify-between mb-3">
                  <h4
                    className="text-lg font-bold"
                    style={{ color: NAVY }}
                  >
                    {plan.name}
                  </h4>
                  <span className="text-2xl font-bold" style={{ color: NAVY }}>
                    {plan.price}
                  </span>
                </div>
                <ul className="space-y-1.5 mb-4">
                  {plan.features.map((f, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">&#x2713;</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleUnlockReport(plan.tier)}
                  disabled={loading}
                  className={cls(
                    "w-full py-3 rounded-xl font-semibold text-sm transition-all",
                    "hover:shadow-lg active:scale-[0.98] disabled:opacity-40"
                  )}
                  style={
                    plan.highlight
                      ? {
                          background: `linear-gradient(135deg, ${GOLD} 0%, #b8960b 100%)`,
                          color: NAVY,
                        }
                      : {
                          background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_DARK} 100%)`,
                          color: "white",
                        }
                  }
                >
                  Unlock {plan.name} Report
                </button>
              </div>
            ))}
          </div>

          <ErrorBanner />
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     STEP 6 — Payment
     ═══════════════════════════════════════════════════════════ */
  if (step === 6) {
    const isMock = !paymentData?.razorpay_key;

    return (
      <div className="min-h-screen bg-[#f8f9fa]">
        <Header subtitle="Complete Payment" />
        <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
          <Card className="text-center">
            <h3 className="text-lg font-bold mb-2" style={{ color: NAVY }}>
              Complete Your Payment
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              {paymentData
                ? `Amount: ₹${(paymentData.amount / 100).toLocaleString("en-IN")}`
                : "Preparing payment..."}
            </p>

            {isMock ? (
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-700 text-xs">
                  Development Mode — Razorpay is not configured. Click below to
                  simulate a successful payment.
                </div>
                <PrimaryBtn onClick={handleMockPayment}>
                  Simulate Payment (Dev Mode)
                </PrimaryBtn>
              </div>
            ) : (
              <PrimaryBtn onClick={handlePayment}>
                Pay with Razorpay
              </PrimaryBtn>
            )}
          </Card>
          <ErrorBanner />
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     STEP 7 — Generating Report
     ═══════════════════════════════════════════════════════════ */
  if (step === 7) {
    return (
      <div className="min-h-screen bg-brand-gradient flex items-center justify-center">
        <div className="text-center px-6 max-w-sm">
          <h1 className="text-2xl font-bold tracking-tight mb-8">
            <span className="text-white">Career</span>
            <span style={{ color: GOLD }}>Disha</span>
          </h1>

          {/* Animated loader */}
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div
              className="absolute inset-0 border-4 rounded-full animate-spin"
              style={{
                borderColor: "rgba(255,255,255,0.15)",
                borderTopColor: GOLD,
              }}
            />
            <div
              className="absolute inset-2 border-4 rounded-full animate-spin"
              style={{
                borderColor: "rgba(255,255,255,0.1)",
                borderTopColor: "white",
                animationDirection: "reverse",
                animationDuration: "1.5s",
              }}
            />
          </div>

          <h2 className="text-white text-lg font-semibold mb-2">
            Generating your personalized report...
          </h2>
          <p className="text-white/50 text-sm mb-4">
            Our AI is analyzing your responses and building a detailed career
            roadmap.
          </p>

          {/* Progress dots */}
          <div className="flex justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full animate-pulse"
                style={{
                  backgroundColor: GOLD,
                  animationDelay: `${i * 0.3}s`,
                }}
              />
            ))}
          </div>

          {reportStatus && (
            <p className="text-white/30 text-xs mt-4 capitalize">
              Status: {reportStatus.replace(/_/g, " ")}
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     STEP 8 — Report Ready
     ═══════════════════════════════════════════════════════════ */
  if (step === 8) {
    const pdfUrl = `${API_BASE}/api/d2c/pdf/${token}`;
    const webReportUrl = `${window.location.origin}/reports/${token}`;
    const shareText = encodeURIComponent(
      `I just completed my AI Career Assessment on CareerDisha! My Holland Code is ${
        previewData?.holland_code || "..."
      }. View my report: ${webReportUrl}`
    );
    const whatsappUrl = `https://wa.me/?text=${shareText}`;

    return (
      <div className="min-h-screen bg-[#f8f9fa]">
        <Header subtitle="Report Ready" />
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
          {/* Celebration */}
          <Card className="text-center">
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="text-xl font-bold mb-1" style={{ color: NAVY }}>
              Your Career Report is Ready!
            </h2>
            <p className="text-gray-500 text-sm">
              Your personalized 12-page career report has been generated.
            </p>
          </Card>

          {/* Holland Code recap */}
          {previewData && (
            <Card className="text-center">
              <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">
                Your Holland Code
              </p>
              <div className="flex justify-center gap-2 mb-2">
                {previewData.holland_code.split("").map((letter, i) => (
                  <span
                    key={i}
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-sm"
                    style={{
                      backgroundColor: RIASEC_COLORS[letter] || "#888",
                    }}
                  >
                    {letter}
                  </span>
                ))}
              </div>
              <p className="text-sm font-medium" style={{ color: NAVY }}>
                {previewData.recommended_stream}
              </p>
            </Card>
          )}

          {/* Download PDF */}
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3.5 rounded-xl font-semibold text-sm text-center
              transition-all hover:shadow-lg active:scale-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${GOLD} 0%, #b8960b 100%)`,
              color: NAVY,
            }}
          >
            Download Full Report (PDF)
          </a>

          {/* View online */}
          <a
            href={webReportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3.5 rounded-xl font-semibold text-sm text-center
              transition-all hover:shadow-lg active:scale-[0.98] border-2"
            style={{ borderColor: NAVY, color: NAVY }}
          >
            View Report Online
          </a>

          {/* Share on WhatsApp */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3.5 rounded-xl font-semibold text-sm text-center
              transition-all hover:shadow-lg active:scale-[0.98] border-2"
            style={{ borderColor: "#25D366", color: "#25D366" }}
          >
            Share on WhatsApp
          </a>

          {/* Retake */}
          <div className="text-center pt-2">
            <a
              href="/assessment"
              className="text-sm text-gray-400 hover:text-gray-600 underline transition-colors"
            >
              Take the assessment again
            </a>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 pb-6">
            &copy; {new Date().getFullYear()} CareerDisha. AI Career Assessment.
          </p>
        </div>
      </div>
    );
  }

  /* fallback */
  return null;
}
