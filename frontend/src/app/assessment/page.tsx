"use client";

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/Toast";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/api\/?$/, "");

/* ── brand tokens ─────────────────────────────────────────── */
const GOLD = "#d4ac0d";

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

/* ── progress persistence ─────────────────────────────────── */
/* The paid flow is 12 screens and 74+ questions, roughly 20 minutes, aimed at
   parents and students on phones — and every answer lived only in React memory.
   A refresh, a back-swipe, an incoming call, or iOS discarding a backgrounded
   tab sent the user back to screen one with nothing saved. */

// _v3: the step numbers changed again when the online report was removed. A
// resume written by an older flow would drop the user on a screen that no longer
// means what it did.
const PROGRESS_KEY = "cn_assessment_progress_v3";

/** Fields worth restoring. Fetched question lists and server-derived preview
 *  data are deliberately excluded — those are re-fetched. */
interface PersistedProgress {
  token: string;
  step: number;
  studentName: string;
  email: string;
  parentPhone: string;
  classLevel: string;
  gender: string;
  income: string;
  location: string;
  parentEdu: string;
  firstGen: boolean;
  mathMarks: string;
  scienceMarks: string;
  englishMarks: string;
  socialStudiesMarks: string;
  strongestSubject: string;
  coachingAfford: string;
  mobility: string;
  parentConcern: string;
  roleModel: string;
  selfEfficacy: Record<string, number>;
  tipiAnswers: Record<string, number>;
  tipiCurrentQ: number;
  crAnswers: Record<string, number>;
  crCurrentQ: number;
  aptAnswers: Record<string, string>;
  aptCurrentQ: number;
  answers: Record<string, number>;
  currentQ: number;
}

function loadProgress(): Partial<PersistedProgress> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // A saved state without a token cannot be resumed against the server.
    return parsed && typeof parsed === "object" && parsed.token ? parsed : null;
  } catch {
    // Private mode, cleared site data, or a browser blocking storage.
    return null;
  }
}

function saveProgress(state: PersistedProgress) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(state));
  } catch {
    // Quota or blocked storage — losing persistence must never break the flow.
  }
}

function clearProgress() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PROGRESS_KEY);
  } catch {
    /* ignore */
  }
}

/* ── helpers ──────────────────────────────────────────────── */
/** Error carrying the HTTP status, so callers can branch on it rather than
 *  pattern-matching the message text. */
class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

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

// The flow runs to step 9: 1-8 are the questions, 9 confirms the answers were
// received. The header once claimed "Step N of 8" and hid the bar from step 8
// on, so a student reached "Step 7 of 8" expecting one screen to go and was then
// handed 74 more questions. There is no online report, payment or generation
// wait any more — the counsellor produces the report and hands it over.
const TOTAL_STEPS = 9;
const LAST_PROGRESS_STEP = 8; // step 9 is the confirmation, not progress

function Header({ step, progressPct, subtitle }: { step: number; progressPct: number; subtitle?: string }) {
  return (
    <header className="bg-brand-gradient text-white py-5 sticky top-0 z-20">
      <div className="max-w-form-narrow mx-auto px-4 text-center">
        <Logo />
        {subtitle && <p className="text-white/60 font-body text-sm mt-1">{subtitle}</p>}
        {step >= 1 && step <= LAST_PROGRESS_STEP && (
          <>
            <div className="mt-3 bg-surface-container-high/20 rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${GOLD}, #2ecc71)` }}
              />
            </div>
            <p className="text-white/40 text-xs mt-1 font-body">Step {step} of {TOTAL_STEPS}</p>
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
function AssessmentFlow() {
  const searchParams = useSearchParams();
  // The quiz links here as /assessment?lead=<lead.token>, a 32-char uuid hex.
  // It was being posted as `lead_id`, which the API typed as an int — so every
  // hand-off from the free quiz 422'd. It is a token, so name it one.
  const leadToken = searchParams.get("lead");

  /* state */
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [nameError, setNameError] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1
  const [studentName, setStudentName] = useState("");
  const [email, setEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [classLevel, setClassLevel] = useState("");

  // Step 2: Context + Academics
  const [gender, setGender] = useState("");
  const [income, setIncome] = useState("");
  const [location, setLocation] = useState("");
  const [parentEdu, setParentEdu] = useState("");
  const [firstGen, setFirstGen] = useState(false);
  const [mathMarks, setMathMarks] = useState("");
  const [scienceMarks, setScienceMarks] = useState("");
  const [englishMarks, setEnglishMarks] = useState("");
  const [socialStudiesMarks, setSocialStudiesMarks] = useState("");
  const [strongestSubject, setStrongestSubject] = useState("");

  // Step 3: Family Context
  const [coachingAfford, setCoachingAfford] = useState("");
  const [mobility, setMobility] = useState("");
  const [parentConcern, setParentConcern] = useState("");
  const [roleModel, setRoleModel] = useState("");

  // Step 4: Self-Efficacy
  const [selfEfficacy, setSelfEfficacy] = useState<Record<string, number>>({});

  // Step 5: TIPI (Big Five)
  const [tipiItems, setTipiItems] = useState<{id: string; text: string; text_hi?: string}[]>([]);
  const [tipiAnswers, setTipiAnswers] = useState<Record<string, number>>({});
  const [tipiCurrentQ, setTipiCurrentQ] = useState(0);

  // Step 6: Career Readiness
  const [crItems, setCrItems] = useState<{id: string; text: string; text_hi?: string}[]>([]);
  const [crAnswers, setCrAnswers] = useState<Record<string, number>>({});
  const [crCurrentQ, setCrCurrentQ] = useState(0);

  // Step 7: Aptitude
  const [aptQuestions, setAptQuestions] = useState<{id: string; text: string; text_hi?: string; options: Record<string, string>; category: string}[]>([]);
  const [aptAnswers, setAptAnswers] = useState<Record<string, string>>({});
  const [aptCurrentQ, setAptCurrentQ] = useState(0);
  const [aptTimeLeft, setAptTimeLeft] = useState(600);
  const aptTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aptAnswersRef = useRef<Record<string, string>>({});

  // Step 8: RIASEC Questions
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [questionsLoading, setQuestionsLoading] = useState(false);


  /* ── restore in-progress work ────────────────────────────── */
  // Runs once, before anything is fetched, so a refresh mid-assessment resumes
  // where the user left off instead of dropping them back on screen one.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const saved = loadProgress();
    if (!saved?.token) return;
    setToken(saved.token);
    if (saved.step) setStep(saved.step);
    if (saved.studentName) setStudentName(saved.studentName);
    if (saved.email) setEmail(saved.email);
    if (saved.parentPhone) setParentPhone(saved.parentPhone);
    if (saved.classLevel) setClassLevel(saved.classLevel);
    if (saved.gender) setGender(saved.gender);
    if (saved.income) setIncome(saved.income);
    if (saved.location) setLocation(saved.location);
    if (saved.parentEdu) setParentEdu(saved.parentEdu);
    if (saved.firstGen !== undefined) setFirstGen(saved.firstGen);
    if (saved.mathMarks) setMathMarks(saved.mathMarks);
    if (saved.scienceMarks) setScienceMarks(saved.scienceMarks);
    if (saved.englishMarks) setEnglishMarks(saved.englishMarks);
    if (saved.socialStudiesMarks) setSocialStudiesMarks(saved.socialStudiesMarks);
    if (saved.strongestSubject) setStrongestSubject(saved.strongestSubject);
    if (saved.coachingAfford) setCoachingAfford(saved.coachingAfford);
    if (saved.mobility) setMobility(saved.mobility);
    if (saved.parentConcern) setParentConcern(saved.parentConcern);
    if (saved.roleModel) setRoleModel(saved.roleModel);
    if (saved.selfEfficacy) setSelfEfficacy(saved.selfEfficacy);
    if (saved.tipiAnswers) setTipiAnswers(saved.tipiAnswers);
    if (saved.tipiCurrentQ !== undefined) setTipiCurrentQ(saved.tipiCurrentQ);
    if (saved.crAnswers) setCrAnswers(saved.crAnswers);
    if (saved.crCurrentQ !== undefined) setCrCurrentQ(saved.crCurrentQ);
    if (saved.aptAnswers) setAptAnswers(saved.aptAnswers);
    if (saved.aptCurrentQ !== undefined) setAptCurrentQ(saved.aptCurrentQ);
    if (saved.answers) setAnswers(saved.answers);
    if (saved.currentQ !== undefined) setCurrentQ(saved.currentQ);
  }, []);

  /* ── save in-progress work ───────────────────────────────── */
  useEffect(() => {
    // Nothing to resume before the server has issued a token.
    if (!token) return;
    // Step 12 means the report is delivered; keeping the draft would resume a
    // finished assessment on the next visit.
    if (step >= 12) {
      clearProgress();
      return;
    }
    saveProgress({
      token, step, studentName, email, parentPhone, classLevel,
      gender, income, location, parentEdu, firstGen,
      mathMarks, scienceMarks, englishMarks, socialStudiesMarks, strongestSubject,
      coachingAfford, mobility, parentConcern, roleModel,
      selfEfficacy, tipiAnswers, tipiCurrentQ, crAnswers, crCurrentQ,
      aptAnswers, aptCurrentQ, answers, currentQ,
    });
  }, [
    token, step, studentName, email, parentPhone, classLevel,
    gender, income, location, parentEdu, firstGen,
    mathMarks, scienceMarks, englishMarks, socialStudiesMarks, strongestSubject,
    coachingAfford, mobility, parentConcern, roleModel,
    selfEfficacy, tipiAnswers, tipiCurrentQ, crAnswers, crCurrentQ,
    aptAnswers, aptCurrentQ, answers, currentQ,
  ]);

  /* ── API helpers ─────────────────────────────────────────── */
  const apiPost = useCallback(
    async (path: string, body?: Record<string, unknown>) => {
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const err = new ApiError(
          body?.detail || `Request failed (${res.status})`,
          res.status
        );
        throw err;
      }
      return res.json();
    },
    []
  );

  /* ── step handlers ──────────────────────────────────────── */

  // Step 1 → start assessment
  const handleStart = async () => {
    if (!studentName.trim()) {
      setNameError("Student name is required.");
      return;
    }
    if (!accessCode.trim()) {
      setCodeError("Enter the code from your school.");
      return;
    }
    setNameError("");
    setCodeError("");
    setLoading(true);
    setError("");
    try {
      const data = await apiPost("/api/d2c/start", {
        student_name: studentName.trim(),
        student_email: email.trim() || undefined,
        parent_phone: parentPhone.trim() || undefined,
        class_level: classLevel || undefined,
        lead_token: leadToken || undefined,
      });
      // Redeem before the first question, not after the last. The code decides
      // which school session this test belongs to and carries the parental
      // consent from that session's signed circular — and batch generation
      // refuses to produce a report without consent. Binding it up front means a
      // student cannot spend 40 minutes answering and only then discover their
      // code is wrong.
      try {
        await apiPost(`/api/d2c/redeem/${data.token}`, { code: accessCode.trim() });
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          setCodeError(
            "That code has already been used, or has expired. Please ask your school for another."
          );
        } else if (e instanceof ApiError && e.status === 404) {
          setCodeError("We do not recognise that code. Please check it and try again.");
        } else {
          setCodeError("Could not check the code just now. Please try again.");
        }
        setLoading(false);
        return;
      }

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

  // Step 2 → save context + academics (mandatory)
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
        social_studies_marks: socialStudiesMarks ? Number(socialStudiesMarks) : undefined,
        strongest_subject: strongestSubject || undefined,
        coaching_affordability: coachingAfford || undefined,
        mobility_willingness: mobility || undefined,
        parent_primary_concern: parentConcern || undefined,
        family_career_role_model: roleModel || undefined,
      });
    } catch {
      toast("Preferences couldn't be saved, but your assessment will continue.", "warning");
    }
    setStep(3);
    setLoading(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Step 3 → family context continue
  const handleFamilyContextContinue = () => {
    setStep(4);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Step 4 → save self-efficacy + load TIPI
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

    // Load TIPI questions
    try {
      const res = await fetch(`${API_BASE}/api/d2c/tipi-questions`);
      if (res.ok) {
        const data = await res.json();
        setTipiItems(data.items || []);
      }
    } catch { /* non-critical */ }

    setStep(5);
    setLoading(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Step 5 → submit TIPI + load career readiness
  const handleTipiSubmit = async () => {
    try {
      await apiPost(`/api/d2c/tipi/${token}`, { responses: tipiAnswers });
    } catch { /* non-critical */ }

    // Load career readiness questions
    try {
      const res = await fetch(`${API_BASE}/api/d2c/career-readiness-questions`);
      if (res.ok) {
        const data = await res.json();
        setCrItems(data.items || []);
      }
    } catch { /* non-critical */ }

    setStep(6);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Step 6 → submit career readiness + load aptitude
  const handleCareerReadinessSubmit = async () => {
    try {
      await apiPost(`/api/d2c/career-readiness/${token}`, { responses: crAnswers });
    } catch { /* non-critical */ }

    // Load aptitude questions
    try {
      const res = await fetch(`${API_BASE}/api/d2c/aptitude-questions`);
      if (res.ok) {
        const data = await res.json();
        setAptQuestions(data.questions || []);
      }
    } catch { /* aptitude is optional */ }

    setStep(7);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Step 7 → submit aptitude + load RIASEC
  const handleAptitudeSubmit = async () => {
    if (aptTimerRef.current) clearInterval(aptTimerRef.current);
    try {
      await apiPost(`/api/d2c/aptitude/${token}`, {
        responses: aptAnswers,
        time_taken: 600 - aptTimeLeft,
      });
    } catch { /* non-critical */ }

    // Load RIASEC questions
    setQuestionsLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(`${API_BASE}/api/d2c/questions`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setQuestions(data.riasec_questions || data.questions || []);
    } catch (e: unknown) {
      const msg = (e as Error)?.name === "AbortError"
        ? "Loading questions timed out. Please check your connection and try again."
        : "Failed to load assessment questions. Please try again.";
      setError(msg);
      setLoading(false);
      setQuestionsLoading(false);
      return;
    }
    setQuestionsLoading(false);
    setStep(8);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSkipAptitude = async () => {
    // Load RIASEC questions directly
    setQuestionsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/d2c/questions`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setQuestions(data.riasec_questions || data.questions || []);
    } catch {
      setError("Failed to load assessment questions. Please try again.");
      setQuestionsLoading(false);
      return;
    }
    setQuestionsLoading(false);
    setStep(8);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Aptitude timer — uses ref for answers to avoid stale closure
  useEffect(() => {
    if (step !== 7 || aptQuestions.length === 0) return;
    aptTimerRef.current = setInterval(() => {
      setAptTimeLeft((t) => {
        if (t <= 1) {
          if (aptTimerRef.current) clearInterval(aptTimerRef.current);
          // Use ref for latest answers to avoid stale closure
          apiPost(`/api/d2c/aptitude/${token}`, {
            responses: aptAnswersRef.current,
            time_taken: 600,
          }).catch(() => {});
          setStep(8);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (aptTimerRef.current) clearInterval(aptTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, aptQuestions.length]);

  // Step 6 → submit RIASEC assessment
  const handleSubmitAssessment = async () => {
    setLoading(true);
    setError("");
    try {
      await apiPost(`/api/d2c/submit/${token}`, {
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
          social_studies: socialStudiesMarks ? Number(socialStudiesMarks) : undefined,
        } : undefined,
      });
      // Nothing to wait for: the counsellor generates the report in batch and
      // hands over the PDF, so the student goes straight to a confirmation.
      setStep(9);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Submission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ── progress % ─────────────────────────────────────────── */
  const progressPct =
    step === 1 ? 0
    : step === 2 ? 8
    : step === 3 ? 14
    : step === 4 ? 20
    : step === 5 ? 26
    : step === 6 ? 32
    : step === 7 ? 38
    : step === 8 ? 38 + (Object.keys(answers).length / Math.max(questions.length, 1)) * 45
    : step === 9 ? 85
    : step === 10 ? 90
    : step === 11 ? 95
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
                  School Code <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={accessCode}
                  onChange={(e) => { setAccessCode(e.target.value.toUpperCase()); if (e.target.value.trim()) setCodeError(""); }}
                  placeholder="e.g. ABCD2345"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={16}
                  className={cls(
                    "sa-input text-center tracking-[0.25em] font-mono uppercase",
                    codeError && "!border-red-400 focus:!border-red-400"
                  )}
                />
                {codeError
                  ? <p className="text-red-500 text-xs mt-1">{codeError}</p>
                  : <p className="text-on-surface-variant text-xs mt-1">
                      From the CareerNeeti sheet your school gave you.
                    </p>}
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
                  placeholder="10-digit mobile number"
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
                  Academic Marks <span className="text-red-500">*</span>{" "}
                  <span className="text-on-surface-variant font-normal font-body">(% in last exam)</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1 font-body">Maths <span className="text-red-500">*</span></label>
                    <input type="number" min={0} max={100} value={mathMarks} onChange={(e) => setMathMarks(e.target.value)} placeholder="%" className="sa-input" />
                  </div>
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1 font-body">Science <span className="text-red-500">*</span></label>
                    <input type="number" min={0} max={100} value={scienceMarks} onChange={(e) => setScienceMarks(e.target.value)} placeholder="%" className="sa-input" />
                  </div>
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1 font-body">English</label>
                    <input type="number" min={0} max={100} value={englishMarks} onChange={(e) => setEnglishMarks(e.target.value)} placeholder="%" className="sa-input" />
                  </div>
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1 font-body">Social Studies</label>
                    <input type="number" min={0} max={100} value={socialStudiesMarks} onChange={(e) => setSocialStudiesMarks(e.target.value)} placeholder="%" className="sa-input" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-heading font-semibold text-on-surface mb-2">
                  Your strongest subject
                </label>
                <OptionButtons
                  options={["Mathematics", "Science", "English", "Social Studies"]}
                  value={strongestSubject}
                  onChange={(v) => setStrongestSubject(v.toLowerCase().replace(/ /g, "_"))}
                />
              </div>
            </div>
          </div>

          <ErrorBanner error={error} />
          <PrimaryBtn loading={loading} onClick={handleContextContinue} disabled={!gender || !income || !location || !parentEdu || !mathMarks || !scienceMarks}>Continue</PrimaryBtn>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     STEP 3 — Family Context
     ═══════════════════════════════════════════════════════════ */
  if (step === 3) {
    return (
      <div className="min-h-screen bg-surface font-body">
        <Header step={step} progressPct={progressPct} subtitle="Family & practical context" />
        <div className="max-w-form-narrow mx-auto px-4 py-8 space-y-5">
          <div className="sa-card">
            <h3 className="text-lg font-heading font-bold text-primary mb-1">
              Family & Practical Context
            </h3>
            <p className="text-on-surface-variant text-sm mb-5">
              This helps us give you realistic, actionable recommendations.
            </p>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-heading font-semibold text-on-surface mb-2">
                  Can your family afford coaching/tuition for entrance exams? <span className="text-red-500">*</span>
                </label>
                <OptionButtons
                  options={["Yes, easily", "Yes, with difficulty", "No"]}
                  value={coachingAfford}
                  onChange={(v) => setCoachingAfford(v === "Yes, easily" ? "yes_easily" : v === "Yes, with difficulty" ? "yes_difficult" : "no")}
                />
              </div>

              <div>
                <label className="block text-sm font-heading font-semibold text-on-surface mb-2">
                  Are you willing to move to another city for college? <span className="text-red-500">*</span>
                </label>
                <OptionButtons
                  options={["Yes", "Maybe", "No"]}
                  value={mobility}
                  onChange={(v) => setMobility(v.toLowerCase())}
                />
              </div>

              <div>
                <label className="block text-sm font-heading font-semibold text-on-surface mb-2">
                  What is your parents&apos; primary concern about your career? <span className="text-red-500">*</span>
                </label>
                <OptionButtons
                  options={["Job security", "High salary", "Follow passion", "Social status"]}
                  value={parentConcern}
                  onChange={(v) => setParentConcern(v.toLowerCase().replace(/ /g, "_"))}
                />
              </div>

              <div>
                <label className="block text-sm font-heading font-semibold text-on-surface mb-2">
                  Is anyone in your family in a profession you admire? <span className="text-on-surface-variant font-normal font-body">(optional)</span>
                </label>
                <input
                  type="text"
                  value={roleModel}
                  onChange={(e) => setRoleModel(e.target.value)}
                  placeholder="e.g., Uncle is an engineer, Mother is a teacher"
                  className="sa-input"
                />
              </div>
            </div>
          </div>

          <ErrorBanner error={error} />
          <PrimaryBtn loading={loading} onClick={handleFamilyContextContinue} disabled={!coachingAfford || !mobility || !parentConcern}>Continue</PrimaryBtn>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     STEP 4 — Self-Efficacy
     ═══════════════════════════════════════════════════════════ */
  if (step === 4) {
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
     STEP 5 — TIPI Big Five Personality (10 items)
     ═══════════════════════════════════════════════════════════ */
  if (step === 5) {
    const tipiQ = tipiItems[tipiCurrentQ];
    const tipiTotal = tipiItems.length;
    const tipiAnsweredCount = Object.keys(tipiAnswers).length;
    const allTipiAnswered = tipiAnsweredCount === tipiTotal && tipiTotal > 0;

    if (!tipiItems.length) {
      return (
        <div className="min-h-screen bg-surface font-body flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-on-surface-variant">Loading personality questions...</p>
            <button onClick={handleTipiSubmit} className="btn-ghost text-sm">Skip to next section</button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-surface font-body">
        <Header step={step} progressPct={progressPct} subtitle={`About You — ${tipiCurrentQ + 1} of ${tipiTotal}`} />
        <div className="max-w-form-narrow mx-auto px-4 py-8">
          <div className="sa-card mb-6">
            <p className="text-sm text-on-surface-variant italic mb-4">I see myself as someone who is...</p>
            {tipiQ && (
              <>
                <div className="flex items-start gap-3 mb-4">
                  <span className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-heading font-bold shrink-0">
                    {tipiCurrentQ + 1}
                  </span>
                  <div>
                    <p className="text-base font-heading font-medium text-on-surface leading-relaxed">{tipiQ.text}</p>
                    {tipiQ.text_hi && <p lang="hi" className="text-sm text-on-surface-variant/60 mt-1">{tipiQ.text_hi}</p>}
                  </div>
                </div>
                <div className="mt-6 space-y-2">
                  {SCALE_LABELS.map((label, i) => {
                    const score = i + 1;
                    const isSelected = tipiAnswers[tipiQ.id] === score;
                    return (
                      <button
                        key={score}
                        onClick={() => {
                          setTipiAnswers((prev) => ({ ...prev, [tipiQ.id]: score }));
                          // Advance only if we are still on the question that
                          // was just answered. The guard used to read the captured
                          // index while the updater incremented the live one, so two
                          // taps inside the 250ms window — the ordinary phone gesture
                          // when the screen has not moved yet — advanced twice and
                          // skipped an item. That left allTipiAnswered false, so
                          // Continue stayed disabled at the end of the section with
                          // nothing on screen saying which question was missed.
                          const answered = tipiCurrentQ;
                          setTimeout(() => {
                            setTipiCurrentQ((c) =>
                              c === answered ? Math.min(c + 1, tipiTotal - 1) : c
                            );
                          }, 250);
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
              </>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setTipiCurrentQ((c) => Math.max(0, c - 1))} disabled={tipiCurrentQ === 0} className="btn-ghost flex-1 py-3 disabled:opacity-30 disabled:cursor-not-allowed">Previous</button>
            {tipiCurrentQ < tipiTotal - 1 ? (
              <button onClick={() => setTipiCurrentQ((c) => c + 1)} disabled={!tipiQ || !tipiAnswers[tipiQ.id]} className="btn-ghost flex-1 py-3 disabled:opacity-30 disabled:cursor-not-allowed">Next</button>
            ) : (
              <button onClick={handleTipiSubmit} disabled={!allTipiAnswered} className={cls("flex-1 py-3 rounded font-heading font-bold text-sm transition-all", allTipiAnswered ? "btn-gold" : "bg-surface-container-highest text-on-surface-variant disabled:opacity-40")}>Continue</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     STEP 6 — Career Readiness (5 items)
     ═══════════════════════════════════════════════════════════ */
  if (step === 6) {
    const crQ = crItems[crCurrentQ];
    const crTotal = crItems.length;
    const crAnsweredCount = Object.keys(crAnswers).length;
    const allCrAnswered = crAnsweredCount === crTotal && crTotal > 0;

    if (!crItems.length) {
      return (
        <div className="min-h-screen bg-surface font-body flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-on-surface-variant">Loading readiness questions...</p>
            <button onClick={handleCareerReadinessSubmit} className="btn-ghost text-sm">Skip to next section</button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-surface font-body">
        <Header step={step} progressPct={progressPct} subtitle={`Career Readiness — ${crCurrentQ + 1} of ${crTotal}`} />
        <div className="max-w-form-narrow mx-auto px-4 py-8">
          <div className="sa-card mb-6">
            {crQ && (
              <>
                <div className="flex items-start gap-3 mb-4">
                  <span className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-heading font-bold shrink-0">
                    {crCurrentQ + 1}
                  </span>
                  <div>
                    <p className="text-base font-heading font-medium text-on-surface leading-relaxed">{crQ.text}</p>
                    {crQ.text_hi && <p lang="hi" className="text-sm text-on-surface-variant/60 mt-1">{crQ.text_hi}</p>}
                  </div>
                </div>
                <div className="mt-6 space-y-2">
                  {SCALE_LABELS.map((label, i) => {
                    const score = i + 1;
                    const isSelected = crAnswers[crQ.id] === score;
                    return (
                      <button
                        key={score}
                        onClick={() => {
                          setCrAnswers((prev) => ({ ...prev, [crQ.id]: score }));
                          const answered = crCurrentQ;
                          setTimeout(() => {
                            setCrCurrentQ((c) =>
                              c === answered ? Math.min(c + 1, crTotal - 1) : c
                            );
                          }, 250);
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
              </>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setCrCurrentQ((c) => Math.max(0, c - 1))} disabled={crCurrentQ === 0} className="btn-ghost flex-1 py-3 disabled:opacity-30 disabled:cursor-not-allowed">Previous</button>
            {crCurrentQ < crTotal - 1 ? (
              <button onClick={() => setCrCurrentQ((c) => c + 1)} disabled={!crQ || !crAnswers[crQ.id]} className="btn-ghost flex-1 py-3 disabled:opacity-30 disabled:cursor-not-allowed">Next</button>
            ) : (
              <button onClick={handleCareerReadinessSubmit} disabled={!allCrAnswered} className={cls("flex-1 py-3 rounded font-heading font-bold text-sm transition-all", allCrAnswered ? "btn-gold" : "bg-surface-container-highest text-on-surface-variant disabled:opacity-40")}>Continue</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     STEP 7 — Aptitude Check (15 questions, 10 min timer)
     ═══════════════════════════════════════════════════════════ */
  if (step === 7) {
    const aptQ = aptQuestions[aptCurrentQ];
    const aptTotal = aptQuestions.length;
    const aptAnsweredCount = Object.keys(aptAnswers).length;
    const aptMin = Math.floor(aptTimeLeft / 60);
    const aptSec = aptTimeLeft % 60;

    if (!aptQuestions.length) {
      // Aptitude questions didn't load — skip to RIASEC
      return (
        <div className="min-h-screen bg-surface font-body flex items-center justify-center">
          <div className="text-center">
            <p className="text-on-surface-variant mb-4">Loading aptitude questions...</p>
            <button onClick={handleSkipAptitude} className="btn-ghost text-sm">Skip to Interest Assessment</button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-surface font-body">
        <Header step={step} progressPct={progressPct} subtitle={`Aptitude Check — Question ${aptCurrentQ + 1} of ${aptTotal}`} />

        <div className="max-w-form-narrow mx-auto px-4 py-4">
          {/* Timer + Progress */}
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-on-surface-variant">{aptAnsweredCount} of {aptTotal} answered</div>
            <div className={`font-heading font-bold text-lg ${aptTimeLeft <= 60 ? "text-red-500 animate-pulse" : "text-primary"}`}>
              {aptMin}:{aptSec.toString().padStart(2, "0")}
            </div>
          </div>

          <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden mb-6">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(aptAnsweredCount / aptTotal) * 100}%` }} />
          </div>

          {aptQ && (
            <div className="sa-card mb-6">
              <div className="flex items-start gap-3 mb-4">
                <span className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-heading font-bold shrink-0">
                  {aptCurrentQ + 1}
                </span>
                <div>
                  <p className="text-base font-heading font-medium text-on-surface leading-relaxed">{aptQ.text}</p>
                  {aptQ.text_hi && <p lang="hi" className="text-sm text-on-surface-variant/60 mt-1">{aptQ.text_hi}</p>}
                  <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{aptQ.category}</span>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                {Object.entries(aptQ.options).map(([letter, text]) => {
                  const isSelected = aptAnswers[aptQ.id] === letter;
                  return (
                    <button
                      key={letter}
                      onClick={() => {
                        setAptAnswers((prev) => {
                          const next = { ...prev, [aptQ.id]: letter };
                          aptAnswersRef.current = next;
                          return next;
                        });
                        const answered = aptCurrentQ;
                        setTimeout(() => {
                          setAptCurrentQ((c) =>
                            c === answered ? Math.min(c + 1, aptTotal - 1) : c
                          );
                        }, 250);
                      }}
                      className={cls(
                        "w-full py-3 px-4 rounded text-left text-sm font-medium transition-all",
                        isSelected
                          ? "btn-primary !w-full !py-3 !px-4 !text-left !text-sm"
                          : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                      )}
                    >
                      <span className="inline-block w-6 font-heading">{letter}.</span> {text}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3">
            <button
              onClick={() => setAptCurrentQ((c) => Math.max(0, c - 1))}
              disabled={aptCurrentQ === 0}
              className="btn-ghost flex-1 py-3 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {aptCurrentQ < aptTotal - 1 ? (
              <button
                onClick={() => setAptCurrentQ((c) => c + 1)}
                disabled={!aptQ || !aptAnswers[aptQ.id]}
                className="btn-ghost flex-1 py-3 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleAptitudeSubmit}
                className="btn-gold flex-1 py-3 font-heading font-bold text-sm"
              >
                Submit Aptitude
              </button>
            )}
          </div>

          <div className="text-center mt-4">
            <button onClick={handleSkipAptitude} className="btn-ghost text-xs text-slate-400">
              Skip aptitude section
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     STEP 8 — RIASEC Assessment (74 questions, one at a time)
     ═══════════════════════════════════════════════════════════ */
  if (step === 8) {
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
     STEP 9 — Preview Results
     ═══════════════════════════════════════════════════════════ */
  // Step 9 — the end of the student's journey.
  //
  // There is no online report, no download and nothing to poll for. The
  // counsellor generates reports in batch and hands over the PDF, so showing a
  // spinner and a download button here would promise something the product does
  // not do.
  if (step === 9) {
    return (
      <div className="min-h-screen bg-surface font-body">
        <Header step={step} progressPct={100} subtitle="All done" />
        <div className="max-w-form-narrow mx-auto px-4 py-12 space-y-6">
          <div className="sa-card text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-heading font-bold text-primary mb-2">
              Your answers are in
            </h2>
            <p className="text-on-surface-variant leading-relaxed">
              Thank you, {studentName || "there"}. Your responses have been recorded.
            </p>
            <p className="text-on-surface-variant leading-relaxed mt-3">
              Your counsellor will prepare your personalised career report and share
              it with you.
            </p>
            <p lang="hi" className="text-sm text-on-surface-variant leading-relaxed mt-3">
              आपके उत्तर दर्ज कर लिए गए हैं। आपके काउंसलर आपकी रिपोर्ट तैयार करके
              आपके साथ साझा करेंगे।
            </p>
          </div>

          <div className="sa-card bg-surface-container-high">
            <p className="text-sm text-on-surface-variant leading-relaxed">
              You can close this page now. There is nothing further to do here.
            </p>
          </div>
        </div>
      </div>
    );
  }


  /* fallback */
  return null;
}

export default function AssessmentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-surface">
          <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      }
    >
      <AssessmentFlow />
    </Suspense>
  );
}
