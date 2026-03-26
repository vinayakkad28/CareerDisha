import logging
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from config import CORS_ORIGINS, OUTPUT_DIR, SENTRY_DSN
from database import init_db, SessionLocal
from rate_limit import limiter
from routers import auth, schools, sessions, students, reports, dashboard, consent, whatsapp, cards, quiz, nps, d2c, coaching, school_portal, audit, feedback, counsellors

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# Sentry (optional)
if SENTRY_DSN:
    try:
        import sentry_sdk
        sentry_sdk.init(dsn=SENTRY_DSN, traces_sample_rate=0.1)
        logger.info("Sentry error tracking initialized")
    except Exception as e:
        logger.warning(f"Sentry init failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"CareerDisha API started. Output dir: {OUTPUT_DIR}")
    yield


app = FastAPI(
    title="CareerDisha API",
    description="AI Career Counselling Platform for Indian Schools",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(schools.router, prefix="/api/schools", tags=["Schools"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["Sessions"])
app.include_router(students.router, prefix="/api/students", tags=["Students"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(consent.router, prefix="/api/consent", tags=["Consent"])
app.include_router(whatsapp.router, prefix="/api/whatsapp", tags=["WhatsApp"])
app.include_router(cards.router, prefix="/api/students", tags=["Cards"])
app.include_router(quiz.router, prefix="/api/quiz", tags=["Quiz"])
app.include_router(nps.router, prefix="/api/nps", tags=["NPS"])
app.include_router(d2c.router, prefix="/api/d2c", tags=["D2C Assessment"])
app.include_router(coaching.router, prefix="/api/coaching", tags=["Coaching"])
app.include_router(school_portal.router, prefix="/api/school-portal", tags=["School Portal"])
app.include_router(audit.router, prefix="/api/audit", tags=["Audit"])
app.include_router(feedback.router, prefix="/api/feedback", tags=["Feedback"])
app.include_router(counsellors.router, prefix="/api/counsellors", tags=["Counsellors"])

# Serve generated PDFs
app.mount("/output", StaticFiles(directory=str(OUTPUT_DIR)), name="output")


@app.get("/api/health")
def health_check():
    """Health check with DB connectivity test."""
    db_status = "connected"
    try:
        db = SessionLocal()
        db.execute("SELECT 1" if hasattr(db, 'execute') else None)
        db.close()
    except Exception:
        db_status = "error"
    return {
        "status": "ok",
        "service": "CareerDisha API",
        "db": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
