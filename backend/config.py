import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Paths
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
TEMPLATES_DIR = BASE_DIR / "templates"
FONTS_DIR = BASE_DIR / "fonts"
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", str(BASE_DIR / "output")))

# Database
# Railway provides DATABASE_URL as postgres:// but SQLAlchemy needs postgresql://
_raw_db_url = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'careerdisha.db'}")
DATABASE_URL = _raw_db_url.replace("postgres://", "postgresql://", 1) if _raw_db_url.startswith("postgres://") else _raw_db_url

# CORS — allow local dev + Railway frontend if deployed separately
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

# Auth
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "changeme")
JWT_SECRET = os.getenv("JWT_SECRET", "careerdisha-secret-change-in-production")
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

# Razorpay (D2C payments)
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")

# D2C Pricing (INR)
D2C_PRICING = {
    "basic": 499,
    "plus": 1999,
    "premium": 2999,
}

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
DEFAULT_LLM_PROVIDER = os.getenv("DEFAULT_LLM_PROVIDER", "groq")
MAX_CONCURRENT_REQUESTS = int(os.getenv("MAX_CONCURRENT_REQUESTS", "5"))

LLM_MODELS = {
    "anthropic": "claude-3-5-haiku-20241022",
    "openai": "gpt-4o-mini",
    "google": "gemini-2.0-flash",
    "groq": "llama-3.3-70b-versatile",
}

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
