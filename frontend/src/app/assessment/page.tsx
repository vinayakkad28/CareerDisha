"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/Toast";
import { RiasecBarChart } from "@/components/RiasecRadarChart";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/api\/?$/, "");

/* ── brand tokens ─────────────────────────────────────────── */
const NAVY = "#1a5276";
const GOLD = "#d4ac0d";

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

/* ── module-level components (stable identity — never defined inside render) ── */
function Logo() {
  return (
    <h1 className="text-2xl font-heading font-bold tracking-tight">
      <span className="text-white">Career</span>
      <span className="text-secondary">Neeti</span>
    </h1>
  );
}

function OptionButtons({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cls(
            "px-4 py-2 rounded text-sm font-medium transition-all",
            value === opt
              ? "btn-primary !inline-flex"
              : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function Header({ step, progressPct, subtitle }: { step: number; progressPct: number; subtitle?: string }) {
  return (
    <header className="bg-brand-gradient text-white py-5 sticky top-0 z-20">
      <div className="max-w-form-narrow mx-auto px-4 text-center">
        <Logo />
        {subtitle && <p className="text-white/60 font-body text-sm mt-1">{subtitle}</p>}
        {step >= 1 && step <= 7 && (
          <>
            <div className="mt-3 bg-surface-container-high/20 rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${GOLD}, #2ecc71)` }}
              />
            </div>
            <p className="text-white/40 text-xs mt-1 font-body">Step {step} of 8</p>
          </>
        )}
      </div>
    </header>
  );
}

function ErrorBanner({ error }: { error: string }) {
  if (!error) return null;
  return (
    <div className="sa-card bg-red-50 text-red-600 text-sm text-center">
      {error}
    </div>
  );
}

function PrimaryBtn({
  children, onClick, disabled, loading, gold, className: extra,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  gold?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cls(
        gold ? "btn-gold" : "btn-gold",
        "w-full py-3.5 font-heading font-bold text-sm",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        extra
      )}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Please wait...
        </span>
      ) : children}
    </button>
  );
}

/* ── component ────────────────────────────────────────────── */
export default function AssessmentPage() {
  const searchParams = useSearchParams();
  const leadId = searchParams.get("lead");

  /* state */
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");
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
      setNameError("Student name is required.");
      return;
    }
    setNameError("");
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

  // Step 2 → save context (mandatory)
  const handleContextContinue = async () => {
    if (!gender || !income || !location || !parentEdu) {
      setError("Please answer all questions before continuing.");
      return;
    }
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
      toast("Preferences couldn't be saved, but your assessment will continue.", "warning");
    }
    setStep(3);
    setLoading(false);
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
      toast("Confidence ratings couldn't be saved, but your assessment will continue.", "warning");
    }

    // Load RIASEC questions with 20s timeout
    setQuestionsLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(`${API_BASE}/api/d2c/questions`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setQuestions(data.riasec_questions || data.questions || []);
    } catch (e: any) {
      const msg = e?.name === "AbortError"
        ? "Loading questions timed out. Please check your connection and try again."
        : "Failed to load assessment questions. Please try again.";
      setError(msg);
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
        student_name: studentName,
        student_email: email || "",
        parent_phone: parentPhone || "",
        class_level: parseInt(classLevel) || 10,
        answers,
        gender: gender || "",
        family_income: income || "",
        location_type: location || "",
        parental_education: parentEdu || "",
        first_gen_learner: firstGen,
        self_efficacy: selfEfficacy,
        academic_marks: (mathMarks || scienceMarks || englishMarks) ? {
          math: mathMarks ? Number(mathMarks) : undefined,
          science: scienceMarks ? Number(scienceMarks) : undefined,
          english: englishMarks ? Number(englishMarks) : undefined,
        } : undefined,
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
          name: "CareerNeeti",
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


  /* ═══════════════════════════════════════════════════════════
     STEP 1 — Landing / Info
     ═══════════════════════════════════════════════════════════ */
  if (step === 1) {
    return (
      <div className="min-h-screen bg-surface font-body">
        <Header step={step} progressPct={progressPct} />
        <div className="max-w-form-narrow mx-auto px-4 py-8 space-y-5">
          <div className="sa-card">
            <div className="text-center mb-6">
              <h2 className="text-xl font-heading font-bold text-primary">
                AI Career Assessment
              </h2>
              <p className="text-on-surface-variant/60 text-sm font-body">
                एआई करियर मूल्यांकन
              </p>
              <p className="text-on-surface-variant text-sm mt-3 leading-relaxed">
                Discover your ideal career path in 20 minutes. Answer 74
                research-backed questions and get a personalized career report
                powered by AI.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-heading font-semibold text-on-surface mb-1">
                  Student Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => { setStudentName(e.target.value); if (e.target.value.trim()) setNameError(""); }}
                  placeholder="Enter your full name"
                  className={cls(
                    "sa-input",
                    nameError && "!border-red-400 focus:!border-red-400"
                  )}
                />
                {nameError && <p className="text-red-500 text-xs mt-1">{nameError}</p>}
              </div>

              <div>
                <label className="block text-sm font-heading font-semibold text-on-surface mb-1">
                  Email{" "}
                  <span className="text-on-surface-variant font-normal font-body">(optional)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="sa-input"
                />
              </div>

              <div>
                <label className="block text-sm font-heading font-semibold text-on-surface mb-1">
                  Parent / Guardian Phone{" "}
                  <span className="text-on-surface-variant font-normal font-body">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="WhatsApp number"
                  className="sa-input"
                />
              </div>

              <div>
                <label className="block text-sm font-heading font-semibold text-on-surface mb-2">
                  Class
                </label>
                <OptionButtons
                  options={CLASS_OPTIONS}
                  value={classLevel}
                  onChange={setClassLevel}
                />
              </div>
            </div>
          </div>

          <ErrorBanner error={error} />
          <PrimaryBtn loading={loading} onClick={handleStart} disabled={!studentName.trim()}>
            Start Assessment
          </PrimaryBtn>

          <p className="text-center text-xs text-on-surface-variant font-body">
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
      <div className="min-h-screen bg-surface font-body">
        <Header step={step} progressPct={progressPct} subtitle="Help us personalize your report" />
        <div className="max-w-form-narrow mx-auto px-4 py-8 space-y-5">
          <div className="sa-card">
            <h3 className="text-lg font-heading font-bold text-primary mb-1">
              Help us personalize your report
            </h3>
            <p className="text-on-surface-variant text-sm mb-5">
              This information helps us give you more relevant and personalized
              recommendations.
            </p>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-heading font-semibold text-on-surface mb-2">
                  Gender <span className="text-red-500">*</span>
                </label>
                <OptionButtons
                  options={GENDER_OPTIONS}
                  value={gender}
                  onChange={setGender}
                />
              </div>

              <div>
                <label className="block text-sm font-heading font-semibold text-on-surface mb-2">
                  Family Income Bracket <span className="text-red-500">*</span>
                </label>
                <OptionButtons
                  options={INCOME_OPTIONS}
                  value={income}
                  onChange={setIncome}
                />
              </div>

              <div>
                <label className="block text-sm font-heading font-semibold text-on-surface mb-2">
                  Location <span className="text-red-500">*</span>
                </label>
                <OptionButtons
                  options={LOCATION_OPTIONS}
                  value={location}
                  onChange={setLocation}
                />
              </div>

              <div>
                <label className="block text-sm font-heading font-semibold text-on-surface mb-2">
                  Parental Education <span className="text-red-500">*</span>
                </label>
                <OptionButtons
                  options={PARENT_EDU_OPTIONS}
                  value={parentEdu}
                  onChange={setParentEdu}
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-heading font-semibold text-on-surface">
                  First-generation learner?
                </label>
                <button
                  onClick={() => setFirstGen(!firstGen)}
                  className={cls(
                    "w-12 h-6 rounded-full transition-all relative",
                    firstGen ? "bg-accent" : "bg-surface-container-highest"
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
                <label className="block text-sm font-heading font-semibold text-on-surface mb-2">
                  Academic Marks{" "}
                  <span className="text-on-surface-variant font-normal font-body">(optional %)</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1 font-body">
                      Maths
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={mathMarks}
                      onChange={(e) => setMathMarks(e.target.value)}
                      placeholder="%"
                      className="sa-input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1 font-body">
                      Science
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={scienceMarks}
                      onChange={(e) => setScienceMarks(e.target.value)}
                      placeholder="%"
                      className="sa-input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1 font-body">
                      English
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={englishMarks}
                      onChange={(e) => setEnglishMarks(e.target.value)}
                      placeholder="%"
                      className="sa-input"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <ErrorBanner error={error} />
          <PrimaryBtn loading={loading} onClick={handleContextContinue} disabled={!gender || !income || !location || !parentEdu}>Continue</PrimaryBtn>
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
      <div className="min-h-screen bg-surface font-body">
        <Header step={step} progressPct={progressPct} subtitle="How confident are you in these areas?" />
        <div className="max-w-form-narrow mx-auto px-4 py-8 space-y-5">
          <div className="sa-card">
            <h3 className="text-lg font-heading font-bold text-primary mb-1">
              Self-Confidence Check
            </h3>
            <p className="text-on-surface-variant text-sm mb-5">
              Rate your confidence in each area. This takes about 30 seconds.
            </p>

            <div className="space-y-5">
              {SELF_EFFICACY_DOMAINS.map((domain) => {
                const val = selfEfficacy[domain];
                return (
                  <div key={domain}>
                    <p className="text-sm font-heading font-semibold text-on-surface mb-2">
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
                            "flex-1 py-2 rounded text-center transition-all text-xs leading-tight font-medium",
                            val === score
                              ? "btn-primary !py-2 !px-1 !text-xs"
                              : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                          )}
                        >
                          {seLabels[score - 1] || score}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <ErrorBanner error={error} />
          {!allSEAnswered && (
            <p className="text-center text-xs text-secondary-500 font-body">
              {6 - Object.keys(selfEfficacy).length} subject{6 - Object.keys(selfEfficacy).length !== 1 ? "s" : ""} still unrated — scroll up to complete
            </p>
          )}
          <PrimaryBtn
            loading={loading}
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
        <div className="min-h-screen bg-surface font-body">
          <Header step={step} progressPct={progressPct} subtitle="Loading assessment..." />
          <div className="max-w-form-narrow mx-auto px-4 py-16 text-center">
            <div className="w-10 h-10 border-3 border-surface-container-highest border-t-primary rounded-full animate-spin mx-auto mb-4" />
            <p className="text-on-surface-variant text-sm">Loading questions...</p>
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
      <div className="min-h-screen bg-surface font-body">
        <header className="bg-brand-gradient text-white py-5 sticky top-0 z-20">
          <div className="max-w-form-narrow mx-auto px-4 text-center">
            <Logo />
            <p className="text-white/60 text-sm mt-1 font-body">
              Question {currentQ + 1} of {totalQ}
            </p>
            <div className="mt-3 bg-surface-container-high/20 rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${((currentQ + 1) / totalQ) * 100}%`,
                  background: `linear-gradient(90deg, ${GOLD}, #2ecc71)`,
                }}
              />
            </div>
            <p className="text-white/40 text-xs mt-1 font-body">
              {answeredCount} answered
            </p>
          </div>
        </header>

        <div className="max-w-form-narrow mx-auto px-4 py-8">
          <div className="sa-card mb-6 animate-slide-in">
            {/* Numbered badge */}
            <div className="flex items-start gap-3 mb-4">
              <span className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-heading font-bold shrink-0">
                {currentQ + 1}
              </span>
              <div>
                <p className="text-base font-heading font-medium text-on-surface leading-relaxed">
                  {q?.text}
                </p>
                {q?.text_hi && (
                  <p className="text-sm text-on-surface-variant/60 mt-1">{q.text_hi}</p>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-2">
              {SCALE_LABELS.map((label, i) => {
                const score = i + 1;
                const isSelected = selectedAnswer === score;
                return (
                  <button
                    key={score}
                    onClick={() => {
                      if (q) {
                        const newAnswers = { ...answers, [String(q.id)]: score };
                        setAnswers(newAnswers);
                        // Auto-advance to next unanswered question
                        setTimeout(() => {
                          // Find the next unanswered question starting from current+1, then wrap to beginning
                          let next = -1;
                          for (let j = currentQ + 1; j < totalQ; j++) {
                            if (!newAnswers[String(questions[j]?.id)]) { next = j; break; }
                          }
                          if (next === -1) {
                            // Check from the start for any unanswered
                            for (let j = 0; j < currentQ; j++) {
                              if (!newAnswers[String(questions[j]?.id)]) { next = j; break; }
                            }
                          }
                          if (next !== -1) {
                            setCurrentQ(next);
                          } else if (currentQ < totalQ - 1) {
                            // All answered — move to last question for submit
                            setCurrentQ(totalQ - 1);
                          }
                        }, 250);
                      }
                    }}
                    className={cls(
                      "w-full py-3 px-4 rounded text-left text-sm font-medium transition-all",
                      isSelected
                        ? "btn-primary !w-full !py-3 !px-4 !text-left !text-sm"
                        : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                    )}
                  >
                    <span className="inline-block w-6 font-heading">{score}.</span> {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            <button
              onClick={() => setCurrentQ((c) => Math.max(0, c - 1))}
              disabled={currentQ === 0}
              className="btn-ghost flex-1 py-3 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {currentQ < totalQ - 1 ? (
              <button
                onClick={() => {
                  // Go to next unanswered, or just next if all ahead are answered
                  let next = -1;
                  for (let j = currentQ + 1; j < totalQ; j++) {
                    if (!answers[String(questions[j]?.id)]) { next = j; break; }
                  }
                  if (next === -1) {
                    for (let j = 0; j < currentQ; j++) {
                      if (!answers[String(questions[j]?.id)]) { next = j; break; }
                    }
                  }
                  setCurrentQ(next !== -1 ? next : currentQ + 1);
                }}
                disabled={!q || !answers[String(q.id)]}
                className="btn-ghost flex-1 py-3 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmitAssessment}
                disabled={!allAnswered || loading}
                className={cls(
                  "flex-1 py-3 rounded font-heading font-bold text-sm transition-all",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  allAnswered ? "btn-gold" : "bg-surface-container-highest text-on-surface-variant"
                )}
              >
                {loading ? "Submitting..." : "Submit Assessment"}
              </button>
            )}
          </div>

          <div className="mt-4">
            <ErrorBanner error={error} />
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     STEP 5 — Preview Results
     ═══════════════════════════════════════════════════════════ */
  if (step === 5) {
    const pd = previewData;

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
      <div className="min-h-screen bg-surface font-body">
        <Header step={step} progressPct={progressPct} subtitle="Your Preview Results" />
        <div className="max-w-form-narrow mx-auto px-4 py-8 space-y-6">
          {/* Holland Code */}
          {pd && (
            <>
              <div className="sa-card text-center">
                <p className="text-xs font-heading uppercase tracking-widest text-on-surface-variant mb-2">
                  Your Holland Code
                </p>
                <div className="flex justify-center gap-2 mb-3">
                  {pd.holland_code.split("").map((letter, i) => (
                    <span
                      key={i}
                      className="w-14 h-14 rounded flex items-center justify-center text-white text-xl font-heading font-bold"
                      style={{
                        backgroundColor: RIASEC_COLORS[letter] || "#888",
                      }}
                    >
                      {letter}
                    </span>
                  ))}
                </div>
                <p className="text-on-surface-variant text-sm">
                  {pd.holland_code
                    .split("")
                    .map((l) => RIASEC_LABELS[l] || l)
                    .join(" / ")}
                </p>
              </div>

              {/* RIASEC bar chart */}
              <div className="sa-card">
                <p className="text-xs font-heading uppercase tracking-widest text-on-surface-variant mb-4 text-center">
                  Your Interest Profile
                </p>
                <RiasecBarChart scores={pd.riasec_scores} />
              </div>

              {/* Stream recommendation */}
              <div className="sa-card text-center">
                <p className="text-xs font-heading uppercase tracking-widest text-on-surface-variant mb-2">
                  Recommended Stream
                </p>
                <h2 className="text-2xl font-heading font-bold text-primary">
                  {pd.recommended_stream}
                </h2>
                <span
                  className={cls(
                    "inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold",
                    pd.confidence === "High"
                      ? "bg-accent-100 text-accent-600"
                      : pd.confidence === "Medium"
                      ? "bg-secondary-100 text-secondary-600"
                      : "bg-surface-container-high text-on-surface-variant"
                  )}
                >
                  Confidence: {pd.confidence}
                </span>
              </div>

              {/* Career teasers as pills */}
              {pd.career_teasers && pd.career_teasers.length > 0 && (
                <div className="sa-card">
                  <p className="text-xs font-heading uppercase tracking-widest text-on-surface-variant mb-3 text-center">
                    Top Career Matches
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {pd.career_teasers.slice(0, 3).map((career, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-secondary-50 text-on-surface rounded-full text-sm font-medium"
                      >
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 bg-secondary"
                        >
                          {i + 1}
                        </span>
                        {typeof career === "string" ? career : (career as {name: string}).name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Blurred/locked full report preview */}
          <div className="sa-card relative overflow-hidden">
            <div className="filter blur-[2px] opacity-50 pointer-events-none select-none">
              <p className="text-sm font-heading font-medium text-on-surface mb-2">
                Detailed Career Pathways
              </p>
              <p className="text-xs text-on-surface-variant mb-1">
                Software Engineering - Expected salary: 8-25 LPA
              </p>
              <p className="text-xs text-on-surface-variant mb-1">
                Data Science - Expected salary: 6-20 LPA
              </p>
              <p className="text-xs text-on-surface-variant mb-3">
                Product Management - Expected salary: 10-30 LPA
              </p>
              <p className="text-sm font-heading font-medium text-on-surface mb-2">
                Recommended Colleges (NIRF 2024)
              </p>
              <p className="text-xs text-on-surface-variant mb-1">
                1. IIT Bombay - Rank #1
              </p>
              <p className="text-xs text-on-surface-variant mb-1">
                2. IIT Delhi - Rank #2
              </p>
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
              <div className="text-center px-4">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-secondary-50 flex items-center justify-center">
                  <svg className="w-6 h-6 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <p className="text-sm font-heading font-bold text-primary mb-2">
                  Your full 12-page report includes:
                </p>
                <ul className="text-xs text-on-surface-variant space-y-1 text-left inline-block">
                  <li className="flex items-center gap-1.5"><span className="text-accent">&#x2713;</span> Detailed career pathways &amp; roadmaps</li>
                  <li className="flex items-center gap-1.5"><span className="text-accent">&#x2713;</span> College lists with NIRF rankings</li>
                  <li className="flex items-center gap-1.5"><span className="text-accent">&#x2713;</span> Salary data &amp; job market outlook</li>
                  <li className="flex items-center gap-1.5"><span className="text-accent">&#x2713;</span> Personalized action plan</li>
                  <li className="flex items-center gap-1.5"><span className="text-accent">&#x2713;</span> Parent guide &amp; next steps</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Pricing cards */}
          <div className="space-y-4">
            <h3 className="text-lg font-heading font-bold text-center text-primary">
              Unlock Your Full Report
            </h3>
            {PRICING.map((plan) => (
              <div
                key={plan.tier}
                className={cls(
                  "sa-card transition-all",
                  plan.highlight && "ring-2 ring-secondary shadow-lg shadow-secondary/10"
                )}
              >
                {plan.highlight && (
                  <span className="inline-block px-3 py-0.5 rounded-full text-xs font-heading font-bold mb-2 text-white bg-secondary">
                    MOST POPULAR
                  </span>
                )}
                <div className="flex items-baseline justify-between mb-3">
                  <h4 className="text-lg font-heading font-bold text-primary">
                    {plan.name}
                  </h4>
                  <span className="text-2xl font-heading font-bold text-primary">
                    {plan.price}
                  </span>
                </div>
                <ul className="space-y-1.5 mb-4">
                  {plan.features.map((f, i) => (
                    <li key={i} className="text-sm text-on-surface-variant flex items-start gap-2">
                      <span className="text-accent mt-0.5">&#x2713;</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleUnlockReport(plan.tier)}
                  disabled={loading}
                  className={cls(
                    "w-full py-3 font-heading font-bold text-sm transition-all",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                    plan.highlight ? "btn-gold" : "btn-primary"
                  )}
                >
                  Unlock {plan.name} Report
                </button>
              </div>
            ))}
          </div>

          <ErrorBanner error={error} />
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
      <div className="min-h-screen bg-surface font-body">
        <Header step={step} progressPct={progressPct} subtitle="Complete Payment" />
        <div className="max-w-form-narrow mx-auto px-4 py-8 space-y-5">
          <div className="sa-card text-center">
            <h3 className="text-lg font-heading font-bold text-primary mb-2">
              Complete Your Payment
            </h3>
            <p className="text-on-surface-variant text-sm mb-4">
              {paymentData
                ? `Amount: ₹${(paymentData.amount / 100).toLocaleString("en-IN")}`
                : "Preparing payment..."}
            </p>

            {/* Order summary */}
            {paymentData && (
              <div className="sa-card bg-surface-container-high mb-4 text-left">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-on-surface-variant">Career Assessment Report</span>
                  <span className="font-heading font-bold text-on-surface">
                    ₹{(paymentData.amount / 100).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-surface-container-highest flex justify-between items-center text-sm">
                  <span className="font-heading font-semibold text-on-surface">Total</span>
                  <span className="font-heading font-bold text-primary text-lg">
                    ₹{(paymentData.amount / 100).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            )}

            {isMock ? (
              <div className="space-y-3">
                <div className="sa-card bg-secondary-50 text-secondary-600 text-xs text-center">
                  Development Mode — Razorpay is not configured. Click below to
                  simulate a successful payment.
                </div>
                <PrimaryBtn loading={loading} onClick={handleMockPayment}>
                  Simulate Payment (Dev Mode)
                </PrimaryBtn>
              </div>
            ) : (
              <button
                onClick={handlePayment}
                disabled={loading}
                className="btn-primary w-full py-3.5 font-heading font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Processing..." : "Pay with Razorpay"}
              </button>
            )}
          </div>
          <ErrorBanner error={error} />
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     STEP 7 — Generating Report
     ═══════════════════════════════════════════════════════════ */
  if (step === 7) {
    return (
      <div className="min-h-screen bg-brand-gradient flex items-center justify-center font-body">
        <div className="text-center px-6 max-w-sm">
          <Logo />
          <div className="mt-8" />

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

          <h2 className="text-white text-lg font-heading font-bold mb-2">
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
                className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse"
                style={{
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
      `I just completed my AI Career Assessment on CareerNeeti! My Holland Code is ${
        previewData?.holland_code || "..."
      }. View my report: ${webReportUrl}`
    );
    const whatsappUrl = `https://wa.me/?text=${shareText}`;

    return (
      <div className="min-h-screen bg-surface font-body">
        <Header step={step} progressPct={progressPct} subtitle="Report Ready" />
        <div className="max-w-form-narrow mx-auto px-4 py-8 space-y-6">
          {/* Celebration */}
          <div className="sa-card text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-accent-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-heading font-bold text-primary mb-1">
              Your Career Report is Ready!
            </h2>
            <p className="text-on-surface-variant text-sm">
              Your personalized 12-page career report has been generated.
            </p>
          </div>

          {/* Holland Code recap */}
          {previewData && (
            <div className="sa-card text-center">
              <p className="text-xs font-heading uppercase tracking-widest text-on-surface-variant mb-2">
                Your Holland Code
              </p>
              <div className="flex justify-center gap-2 mb-2">
                {previewData.holland_code.split("").map((letter, i) => (
                  <span
                    key={i}
                    className="w-12 h-12 rounded flex items-center justify-center text-white text-lg font-heading font-bold"
                    style={{
                      backgroundColor: RIASEC_COLORS[letter] || "#888",
                    }}
                  >
                    {letter}
                  </span>
                ))}
              </div>
              <p className="text-sm font-heading font-medium text-primary">
                {previewData.recommended_stream}
              </p>
            </div>
          )}

          {/* Download PDF */}
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold block w-full py-3.5 font-heading font-bold text-sm text-center"
          >
            Download Full Report (PDF)
          </a>

          {/* View online */}
          <a
            href={webReportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost block w-full py-3.5 font-heading font-bold text-sm text-center"
          >
            View Report Online
          </a>

          {/* Share on WhatsApp */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3.5 rounded font-heading font-bold text-sm text-center
              transition-all hover:shadow-lg active:scale-[0.98]"
            style={{ backgroundColor: "#25D366", color: "white" }}
          >
            Share on WhatsApp
          </a>

          {/* Retake */}
          <div className="text-center pt-2">
            <a
              href="/assessment"
              className="text-sm text-on-surface-variant hover:text-on-surface underline transition-colors"
            >
              Take the assessment again
            </a>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-on-surface-variant pb-6">
            &copy; {new Date().getFullYear()} CareerNeeti. AI Career Assessment.
          </p>
        </div>
      </div>
    );
  }

  /* fallback */
  return null;
}
