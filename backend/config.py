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
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24

# LLM
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
DEFAULT_LLM_PROVIDER = os.getenv("DEFAULT_LLM_PROVIDER", "anthropic")
MAX_CONCURRENT_REQUESTS = int(os.getenv("MAX_CONCURRENT_REQUESTS", "5"))

LLM_MODELS = {
    "anthropic": "claude-3-5-haiku-20241022",
    "openai": "gpt-4o-mini",
    "google": "gemini-2.0-flash",
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

# Class-specific prompt instructions
CLASS_INSTRUCTIONS = {
    8: """This student is in Class 8 (age 13-14). They are 2 years away from stream selection.
FOCUS: Career EXPLORATION and self-discovery. Help them understand their interests.
DO: Describe career options in simple, exciting terms. Use relatable examples.
DO: Suggest activities, hobbies, and school projects to explore their interests further.
DO: Recommend streams (Science/Commerce/Arts) broadly, not rigidly.
DO NOT: List specific entrance exam cutoffs or college rankings in detail.
DO NOT: Create urgency or pressure about career decisions.
PARENT SECTION: "Your child has 2 years before stream selection. Here's how to help them explore." """,

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
