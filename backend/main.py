import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from config import CORS_ORIGINS, OUTPUT_DIR
from database import init_db
from routers import auth, schools, sessions, students, reports, dashboard, consent

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


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

# Serve generated PDFs
app.mount("/output", StaticFiles(directory=str(OUTPUT_DIR)), name="output")


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "CareerDisha API"}
