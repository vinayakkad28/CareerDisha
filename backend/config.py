import logging
import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Environment — controls whether insecure development fallbacks are permitted.
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").strip().lower()
IS_PRODUCTION = ENVIRONMENT in ("production", "prod", "live")


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


# Create tables directly from the models at startup instead of requiring Alembic.
# Convenient for tests and a throwaway local database; NEVER for a real one:
# create_all() creates missing TABLES but cannot ALTER existing ones, so once a
# database exists it silently stops applying model changes — which is exactly how
# 12 columns went missing from every deployed database.
AUTO_CREATE_SCHEMA = _env_flag("AUTO_CREATE_SCHEMA", default=False)

# Paths
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
TEMPLATES_DIR = BASE_DIR / "templates"
FONTS_DIR = BASE_DIR / "fonts"
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", str(BASE_DIR / "output")))

# Database
# Railway provides DATABASE_URL as postgres:// but SQLAlchemy needs postgresql://
_raw_db_url = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'careerneeti.db'}")
DATABASE_URL = _raw_db_url.replace("postgres://", "postgresql://", 1) if _raw_db_url.startswith("postgres://") else _raw_db_url

# CORS — explicit allow-list plus a tightly anchored regex.
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

# The previous regex was r"https://.*\.vercel\.app|https://.*careerneeti\.in".
# Starlette matches it with re.fullmatch, so `.*` made it far wider than intended:
# ANY Vercel-hosted site matched the first branch, and `evilcareerneeti.in`
# matched the second — both with allow_credentials=True. These patterns are
# anchored to real subdomains of careerneeti.in only. Vercel preview deploys are
# opt-in via CORS_ORIGIN_REGEX (e.g. r"https://frontend-[a-z0-9-]+\.vercel\.app").
CORS_ORIGIN_REGEX = os.getenv(
    "CORS_ORIGIN_REGEX",
    r"https://([a-z0-9-]+\.)?careerneeti\.in",
)

# Auth
#
# There are deliberately NO hardcoded production defaults here. The previous
# fallbacks ("changeme" / "careerneeti-secret-change-in-production") were
# published in this file, so anyone could forge an admin JWT against any
# deployment that forgot to set the env vars. In production we refuse to boot;
# in development we generate an ephemeral secret so local work still runs.
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
JWT_SECRET = os.getenv("JWT_SECRET", "")

_missing_secrets = [
    name
    for name, value in (("ADMIN_PASSWORD", ADMIN_PASSWORD), ("JWT_SECRET", JWT_SECRET))
    if not value.strip()
]
if _missing_secrets:
    if IS_PRODUCTION:
        raise RuntimeError(
            "Refusing to start: "
            + ", ".join(_missing_secrets)
            + " must be set when ENVIRONMENT=production. "
            "Set them in the host's environment (Render generates JWT_SECRET for you)."
        )
    # Development: ephemeral per-process secret. Tokens do not survive a restart,
    # which is the intended behaviour — it keeps a weak secret from being reused.
    if not JWT_SECRET.strip():
        JWT_SECRET = secrets.token_urlsafe(48)
    if not ADMIN_PASSWORD.strip():
        ADMIN_PASSWORD = secrets.token_urlsafe(12)
    logger.warning(
        "Development mode: generated ephemeral %s. Set them in .env for stable local logins.",
        " and ".join(_missing_secrets),
    )

JWT_EXPIRY_HOURS = 24

# JWT RS256 keys (optional — fallback to HS256 with JWT_SECRET if not set)
_jwt_private_key_path = os.getenv("JWT_PRIVATE_KEY_PATH", "")
_jwt_public_key_path = os.getenv("JWT_PUBLIC_KEY_PATH", "")
JWT_PRIVATE_KEY = None
JWT_PUBLIC_KEY = None
JWT_ALGORITHM = "HS256"
if _jwt_private_key_path and Path(_jwt_private_key_path).exists():
    JWT_PRIVATE_KEY = Path(_jwt_private_key_path).read_text()
    JWT_PUBLIC_KEY = Path(_jwt_public_key_path).read_text() if _jwt_public_key_path and Path(_jwt_public_key_path).exists() else None
    JWT_ALGORITHM = "RS256"

# Monitoring
SENTRY_DSN = os.getenv("SENTRY_DSN", "")

# WhatsApp
WHATSAPP_PROVIDER = os.getenv("WHATSAPP_PROVIDER", "")  # "meta" or "twilio"
META_WHATSAPP_TOKEN = os.getenv("META_WHATSAPP_TOKEN", "")
META_PHONE_NUMBER_ID = os.getenv("META_PHONE_NUMBER_ID", "")
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM", "")

# Open house: hand the report to anyone who completes the assessment, with no
# school access code. Off for the pilot, where the code is what carries both the
# entitlement and the parental consent evidenced by the school's paper circular.
#
# This is NOT a payment flag. It is also the switch that makes report generation
# start at all (routers/d2c.py), so removing it strands every online assessment.
FREE_REPORTS = _env_flag("FREE_REPORTS", default=False)

# Email (SMTP)
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "")

# LLM
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
# Default to Google. The previous default resolved to llama-3.1-8b-instant,
# which the repo's own fix_groq.py scores 0 — "too small for this schema" — and
# which truncates the ~20-section report into a QA failure. Measured on
# gemini-3.5-flash: a complete 13-section, ~45k character report in about 60s.
DEFAULT_LLM_PROVIDER = os.getenv("DEFAULT_LLM_PROVIDER", "google")
MAX_CONCURRENT_REQUESTS = int(os.getenv("MAX_CONCURRENT_REQUESTS", "5"))

# Model IDs are env-overridable. Providers retire models and gate others behind
# account tiers, and when that happens the API returns 404 "does not exist or you
# do not have access to it" — which previously required a code change and redeploy
# to fix. Override the one you need (e.g. GROQ_MODEL) in the host's environment.
LLM_MODELS = {
    "anthropic": os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-20241022"),
    "openai": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
    # gemini-2.0-flash and gemini-2.5-flash are both retired — the API answers
    # 404 "no longer available" and names a successor. Verified 2026-09-01:
    # gemini-3.5-flash returns the full report schema in about 30s.
    "google": os.getenv("GOOGLE_MODEL", "gemini-3.5-flash"),
    "groq": os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
}

# Provider → key, so callers can check configuration without a chain of ifs.
LLM_API_KEYS = {
    "anthropic": ANTHROPIC_API_KEY,
    "openai": OPENAI_API_KEY,
    "google": GOOGLE_API_KEY,
    "groq": GROQ_API_KEY,
}

# Report generation is dead on arrival without the default provider's key, and
# the failure only used to surface on the first real report. Warn at boot.
if not LLM_API_KEYS.get(DEFAULT_LLM_PROVIDER, "").strip():
    logger.warning(
        "DEFAULT_LLM_PROVIDER=%s but its API key is not set — report generation will fail.",
        DEFAULT_LLM_PROVIDER,
    )

# Request timeout for LLM calls. The SDKs default to 600s with their own internal
# retries nested inside our retry loop, which can hang a report thread for hours.
LLM_TIMEOUT_SECONDS = int(os.getenv("LLM_TIMEOUT_SECONDS", "90"))

# Output ceiling for report generation.
#
# This was 12,000, and a complete report measures ~45,000 characters — roughly
# 11-12k tokens. Sitting on the ceiling meant Gemini truncated mid-string often
# enough to matter, and the only thing that caught it was json.loads raising
# "Unterminated string": a parse error that happens to be retried, by accident
# rather than design. When the retries truncated too, the customer got nothing
# and the row rolled back to "assessment_complete" with no explanation.
#
# Headroom is nearly free — output is billed per token emitted, not per token
# allowed — so give the model room to finish the schema it was asked for.
#
# But the ceiling is PER PROVIDER, because a value above a model's own cap is a
# hard 400, not a clamp. This was briefly a single 32,000 applied to all four:
# gpt-4o-mini caps completion at 16,384, so every OpenAI call would have failed —
# and _is_permanent_llm_error classifies 400 as permanent, so LLMClient.generate
# re-raises with NO retry. An entire 300-student batch would have died in seconds
# with nothing surfacing the reason in the UI.
LLM_MAX_OUTPUT_TOKENS = int(os.getenv("LLM_MAX_OUTPUT_TOKENS", "32000"))

# Per-provider output caps. A provider absent here falls back to the value above.
# groq's entry is deliberately conservative: fix_groq.py exists because models on
# that endpoint reject large max_tokens outright, and its own APP_MAX_TOKENS must
# be kept in step with whatever is set here.
LLM_PROVIDER_MAX_OUTPUT_TOKENS = {
    "google": LLM_MAX_OUTPUT_TOKENS,
    "openai": int(os.getenv("OPENAI_MAX_OUTPUT_TOKENS", "16000")),   # gpt-4o-mini caps at 16,384
    "groq": int(os.getenv("GROQ_MAX_OUTPUT_TOKENS", "12000")),       # must match fix_groq.py
    # anthropic is not listed: _call_anthropic deliberately uses a fixed 8192 and
    # splits generation into two passes to stay under it.
}


def max_output_tokens_for(provider: str) -> int:
    """Output ceiling this provider will actually accept."""
    return LLM_PROVIDER_MAX_OUTPUT_TOKENS.get(provider, LLM_MAX_OUTPUT_TOKENS)

# RIASEC Configuration
RIASEC_TYPES = ["R", "I", "A", "S", "E", "C"]
RIASEC_TYPE_NAMES = {
    "R": "Realistic",
    "I": "Investigative",
    "A": "Artistic",
    "S": "Social",
    "E": "Enterprising",
    "C": "Conventional",
}

# Relatable archetype labels — used in report to make RIASEC feel personal
RIASEC_ARCHETYPES = {
    "R": "The Builder",
    "I": "The Thinker",
    "A": "The Creator",
    "S": "The Helper",
    "E": "The Leader",
    "C": "The Organiser",
}

# Per-type colours — used for consistent colour-coding across report
RIASEC_COLORS = {
    "R": "#27ae60",  # Green
    "I": "#2980b9",  # Blue
    "A": "#8e44ad",  # Purple
    "S": "#e67e22",  # Orange
    "E": "#c0392b",  # Red
    "C": "#16a085",  # Teal
}
ITEMS_PER_DIMENSION = 11
WORK_VALUES_ITEMS = 8

# Likert scale mapping: OMR bubble → score
LIKERT_MAP = {"A": 1, "B": 2, "C": 3, "D": 4, "E": 5}

# Stream recommendation
STREAMS = ["Science (PCM)", "Science (PCB)", "Commerce", "Arts/Humanities"]
STREAM_DIMENSION_WEIGHTS = {
    "interest": 0.25,
    "academic": 0.25,
    "aptitude": 0.20,
    "personality": 0.15,
    "feasibility": 0.15,
}

# Career Readiness thresholds
CAREER_READINESS_THRESHOLDS = {
    "decision_ready": 75,
    "exploring": 50,
    "early_stage": 25,
    "undecided": 0,
}

# Brand colors
BRAND_COLORS = {
    "primary": "#1a5276",    # Dark blue
    "secondary": "#d4ac0d",  # Gold
    "accent": "#2ecc71",     # Green
    "light_bg": "#f8f9fa",
    "text": "#2c3e50",
}

# Supported class levels (Class 8 removed — too young for actionable career guidance)
SUPPORTED_CLASSES = [9, 10, 11, 12]

# Class-specific prompt instructions
CLASS_INSTRUCTIONS = {
    8: """This student is in Class 8 (age 13-14). Career decision is 2+ years away.
FOCUS: Career EXPLORATION — broad curiosity, self-discovery, and interest mapping.
DO: Help the student explore diverse career fields without narrowing prematurely.
DO: Show how their RIASEC profile maps to general career clusters.
DO: Suggest extracurriculars, books, and activities that build self-awareness.
DO NOT: Recommend specific entrance exams or coaching institutes yet.
DO NOT: Pressure stream selection — it is still far away.
PARENT SECTION: "Your child is at an ideal stage for exploration. Here's how to nurture their interests." """,

    9: """This student is in Class 9 (age 14-15). Stream selection is 1 year away.
FOCUS: Career EXPLORATION with stream awareness. Connect interests to broad career fields.
DO: Explain what each stream (Science PCM, Science PCB, Commerce, Arts) opens up.
DO: Show how their RIASEC profile maps to specific streams.
DO: Suggest preparatory steps for Class 10 boards.
DO NOT: List specific JEE/NEET cutoffs yet.
PARENT SECTION: "Stream selection is approaching. Here's what to consider based on your child's profile." """,

    10: """This student is in Class 10 (age 15-16). Stream selection is IMMINENT (within 2-3 months after board results).
FOCUS: CLEAR STREAM RECOMMENDATION with specific reasoning.
DO: Give a definitive stream recommendation (Science PCM / Science PCB / Commerce with Maths / Commerce without Maths / Arts with specific subjects).
DO: Explain exactly WHY this stream matches their profile.
DO: List the entrance exams they'll face in Class 12 based on the recommended stream.
DO: Include subject combination advice within the stream.
DO: Mention coaching requirements honestly (when needed vs. when self-study works).
DO: Address the common scenario where parent preference differs from student aptitude.
PARENT SECTION: Must be highly specific. "We recommend [Stream] because [reasons]. Here's the 2-year plan." """,

    11: """This student is in Class 11 (age 16-17). Stream is already chosen.
FOCUS: CAREER NARROWING within their chosen stream.
DO: Recommend specific career paths WITHIN their stream, not across all streams.
DO: Provide entrance exam preparation timelines and strategies.
DO: Suggest specific colleges to target based on realistic score expectations.
DO: Include backup options if primary career path doesn't work out.
PARENT SECTION: "Your child is on track for [Career]. Here's the preparation timeline for the next 18 months." """,

    12: """This student is in Class 12 (age 17-18). Board exams are imminent or results are expected.
FOCUS: IMMEDIATE ACTION PLAN. This report must be maximally actionable.
DO: List specific colleges with cutoff ranges for their expected score bracket.
DO: Include application deadlines, registration dates, and counselling round schedules.
DO: Provide a month-by-month calendar from now until admission.
DO: Include backup options and alternative pathways.
DO: Mention gap year options honestly if applicable.
DO: Include scholarship information where relevant.
PARENT SECTION: "Action items for the next 90 days" — specific dates and tasks.""",
}

# Session status flow
SESSION_STATUSES = [
    "draft",
    "scored",
    "generating",
    "generated",
    "qa_review",
    "pdf_ready",
    "delivered",
]

# Student report status flow
REPORT_STATUSES = [
    "pending",
    "scored",
    "report_generated",
    "qa_passed",
    "qa_flagged",
    "pdf_ready",
    "delivered",
]
