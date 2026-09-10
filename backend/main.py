import logging
import time
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from config import (
    AUTO_CREATE_SCHEMA,
    BASE_DIR,
    CORS_ORIGIN_REGEX,
    CORS_ORIGINS,
    DEFAULT_LLM_PROVIDER,
    IS_PRODUCTION,
    LLM_API_KEYS,
    OUTPUT_DIR,
    SENTRY_DSN,
)
from database import init_db, SessionLocal
from rate_limit import limiter
from routers import auth, schools, sessions, students, reports, dashboard, consent, cards, quiz, nps, d2c, coaching, school_portal, audit, feedback, counsellors, outcomes

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


def _assert_schema_current() -> None:
    """Fail fast if the database is not migrated to the revision this code expects.

    Previously startup called create_all(), which quietly creates missing tables
    but never alters existing ones. A deploy would come up green while columns
    added by recent commits were absent, and the failure surfaced later as a 500
    from whichever endpoint touched them. Refusing to boot turns that into one
    obvious error at deploy time.
    """
    from alembic.config import Config
    from alembic.runtime.migration import MigrationContext
    from alembic.script import ScriptDirectory

    from database import engine

    expected = ScriptDirectory.from_config(
        Config(str(BASE_DIR / "alembic.ini"))
    ).get_current_head()
    with engine.connect() as conn:
        actual = MigrationContext.configure(conn).get_current_revision()

    if actual != expected:
        raise RuntimeError(
            f"Database schema is at revision {actual!r} but this code expects "
            f"{expected!r}. Run 'alembic upgrade head' before starting the API."
        )


def _warm_pdf_stack() -> None:
    """Pay the WeasyPrint import cost at boot instead of in someone's request.

    Every PDF route imported weasyprint lazily, inside the handler. The first
    such call in a fresh container therefore paid, mid-request, for the ctypes
    dlopen of Pango/Cairo/GObject plus a fontconfig scan. On a small instance
    that was slow enough to drop the connection — the compliance certificate and
    the parent circular both failed in production while the JSON variant of the
    same endpoint returned 200, and both rendered locally in half a second
    against a warm cache.

    Importing here moves that cost to startup, where the platform's own health
    check absorbs it. Deliberately non-fatal: a PDF backend that cannot load
    should degrade those two endpoints, not stop the API from serving.
    """
    import time

    started = time.monotonic()
    try:
        import engines.pdf_generator  # noqa: F401  (imports weasyprint + matplotlib)

        logger.info(f"PDF stack warmed in {time.monotonic() - started:.1f}s")
    except Exception as e:
        logger.error(f"PDF stack failed to load — PDF routes will error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if AUTO_CREATE_SCHEMA:
        init_db()
    else:
        _assert_schema_current()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    _warm_pdf_stack()
    logger.info(f"CareerNeeti API started. Output dir: {OUTPUT_DIR}")
    yield


app = FastAPI(
    title="CareerNeeti API",
    description="AI Career Counselling Platform for Indian Schools",
    version="1.0.0",
    lifespan=lifespan,
    # Interactive API docs publish every route and payload shape, including the
    # payment endpoints. Keep them off in production.
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
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
app.include_router(cards.router, prefix="/api/students", tags=["Cards"])
app.include_router(quiz.router, prefix="/api/quiz", tags=["Quiz"])
app.include_router(nps.router, prefix="/api/nps", tags=["NPS"])
app.include_router(nps.public_router, prefix="/api/nps", tags=["NPS"])
app.include_router(d2c.router, prefix="/api/d2c", tags=["D2C Assessment"])
app.include_router(coaching.router, prefix="/api/coaching", tags=["Coaching"])
app.include_router(school_portal.router, prefix="/api/school-portal", tags=["School Portal"])
app.include_router(audit.router, prefix="/api/audit", tags=["Audit"])
app.include_router(feedback.router, prefix="/api/feedback", tags=["Feedback"])
app.include_router(feedback.summary_router, prefix="/api/feedback", tags=["Feedback"])
app.include_router(counsellors.router, prefix="/api/counsellors", tags=["Counsellors"])
app.include_router(outcomes.router, prefix="/api/outcomes", tags=["Outcomes"])
app.include_router(outcomes.public_router, prefix="/api/outcomes", tags=["Outcomes"])

# NOTE: generated report PDFs are deliberately NOT served as static files.
#
# There was a `app.mount("/output", StaticFiles(...))` here, which published
# every generated report to the open internet with no authentication. Filenames
# are "{StudentName}_career_report.pdf", so guessing a child's name returned
# their full psychometric profile, school, and parent contact details. Nothing
# in the frontend or backend referenced these URLs — it was pure exposure.
#
# PDFs are served by authenticated, tenant-scoped routes instead:
#   GET /api/students/{student_id}/pdf   (staff, scoped to their schools)
#   GET /api/d2c/pdf/{token}             (customer, gated on payment)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/api/health")
def health_check():
    """Health check with real dependency states.

    Returns 503 when the database is unreachable so that platform health
    checks and uptime monitors get a truthful signal.
    """
    # Neon's free tier suspends the compute after 5 minutes idle and wakes it on
    # the next connection, so the first probe after a quiet period legitimately
    # times out while the database is starting. A single-shot probe reports that
    # as "error" and, because this path is Render's healthCheckPath, a healthy
    # service gets restarted for doing nothing but idling. Retry once before
    # concluding the database is down.
    db_status = "error"
    last_error = None
    for attempt in range(2):
        try:
            db = SessionLocal()
            try:
                db.execute(text("SELECT 1"))
                db_status = "connected"
                break
            finally:
                # Must close even when execute() raises, or every health-check
                # poll leaks a pooled connection until the pool is exhausted.
                db.close()
        except Exception as e:
            last_error = e
            if attempt == 0:
                time.sleep(2)
    if db_status != "connected":
        logger.warning(f"Health check DB probe failed after 2 attempts: {last_error}")

    llm_key_present = bool(LLM_API_KEYS.get(DEFAULT_LLM_PROVIDER, ""))
    healthy = db_status == "connected"

    body = {
        "status": "ok" if healthy else "degraded",
        "service": "CareerNeeti API",
        "db": db_status,
        "llm_provider": DEFAULT_LLM_PROVIDER,
        "llm_key_configured": llm_key_present,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    return JSONResponse(status_code=200 if healthy else 503, content=body)
