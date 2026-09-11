#!/usr/bin/env python3
"""Drive the counsellor's screens in a real browser, and prove files arrive.

    pip install playwright && python -m playwright install chromium

    # terminal 1 — backend on 8000, using this script's seed database
    cd backend
    DATABASE_URL=sqlite:///rehearsal.db python -m alembic upgrade head
    DATABASE_URL=sqlite:///rehearsal.db ADMIN_PASSWORD=rehearse JWT_SECRET=x \
        python -m uvicorn main:app --port 8000
    # terminal 2 — ALLOW_LOCAL_API lets the CSP reach a local backend
    cd frontend && ALLOW_LOCAL_API=1 pnpm build && ALLOW_LOCAL_API=1 PORT=3099 pnpm start
    # terminal 3
    DATABASE_URL=sqlite:///backend/rehearsal.db ADMIN_PASSWORD=rehearse \
        python scripts/rehearse_counsellor_flow.py

Why a browser and not an API test: both download bugs this was written for are
invisible to `requests`. The per-student link was a bare <a href> to a route
behind an auth dependency, and a browser cannot put an Authorization header on
one. And downloadFile() built a detached anchor and revoked the blob URL on the
very next line, so the fetch succeeded, the success toast fired, and no file was
ever written. Only `expect_download` can tell those apart from working.

It seeds its own data straight into the database — no LLM call, no cost.
"""

import os
import re
import sys
from datetime import date
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND))

WEB = os.environ.get("WEB_BASE", "http://localhost:3099")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "rehearse")

ok: list[bool] = []


def step(label: str, good: bool, extra: str = "") -> bool:
    print(f"{'PASS' if good else 'FAIL'}  {label} {extra}")
    ok.append(good)
    return good


def seed() -> tuple[int, str]:
    """A session with one QA-passed student and a real PDF on disk."""
    from database import SessionLocal
    from engines.pdf_generator import ensure_student_pdf
    from models import School, Session as SessionModel, Student

    db = SessionLocal()
    try:
        school = db.query(School).filter(School.code == "REH").first()
        if not school:
            school = School(name="Rehearsal School", code="REH", city="Meerut",
                            contact_phone="9990000001")
            db.add(school)
            db.commit()
        session = SessionModel(school_id=school.id, session_date=date.today(),
                               counsellor_name="V. Kad", status="qa_review")
        db.add(session)
        db.commit()

        student = Student(
            session_id=session.id, student_id_external=f"REH-{session.id}",
            name="Riya Sharma", class_level=10, holland_code="IRA",
            riasec_scores={"R": 60, "I": 80, "A": 70, "S": 40, "E": 50, "C": 30},
            consent_obtained=True, consent_method="paper_form",
            parent_name="Parent", parent_phone="9990000011",
            report_status="pdf_ready",
            report_content={
                "riasec_profile": {"summary": "Investigative and realistic. " * 12},
                "stream_recommendation": {"recommended_stream": "Science (PCM)"},
                "career_matches": [
                    {"career_name": f"Career {i}", "why_it_fits": "w" * 120,
                     "education_pathway": "e" * 120, "top_colleges": ["IIT Bombay"]}
                    for i in range(5)
                ],
                "action_plan": {"next_3_months": ["Talk to a teacher"]},
                "parent_section": {"title": "अभिभावकों के लिए",
                                   "recommendation_summary": "प" * 200},
            },
        )
        db.add(student)
        db.commit()
        ensure_student_pdf(student, db)
        return session.id, student.name
    finally:
        db.close()


def main() -> int:
    from playwright.sync_api import sync_playwright

    session_id, student_name = seed()
    print(f"seeded session {session_id} with 1 QA-passed student\n")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(accept_downloads=True)
        bad: list[str] = []
        page.on("response", lambda r: bad.append(f"{r.status} {r.request.url}")
                if "/api/" in r.request.url and r.status >= 400 else None)

        page.goto(f"{WEB}/login", wait_until="networkidle")
        page.fill("input[type='password']", ADMIN_PASSWORD)
        page.get_by_role("button", name=re.compile("log ?in|sign ?in", re.I)).first.click()
        page.wait_for_timeout(2500)
        step("counsellor can log in", "/login" not in page.url, page.url)

        page.goto(f"{WEB}/sessions/{session_id}", wait_until="networkidle")
        page.wait_for_timeout(1500)
        body = page.inner_text("body")
        step("the session page loads", student_name in body)

        # The card read a key the backend does not send, so it showed 0/N through
        # a completely successful run — the single most misleading thing on the
        # screen when someone says "generation never finishes".
        m = re.search(r"PDFs Ready\s*(\d+)\s*/\s*(\d+)", body)
        step("PDFs Ready reflects reality", bool(m) and m.group(1) != "0",
             m.group(0).replace("\n", " ") if m else "card not found")

        zip_btn = page.get_by_role("button", name=re.compile("Download ZIP", re.I))
        step("Download ZIP is not greyed out", zip_btn.count() > 0 and zip_btn.first.is_enabled())

        try:
            with page.expect_download(timeout=45000) as dl:
                zip_btn.first.click()
            path = dl.value.path()
            size = Path(path).stat().st_size if path else 0
            step("Download ZIP actually saves a file", size > 0, f"{size} bytes")
        except Exception as e:
            step("Download ZIP actually saves a file", False, type(e).__name__)

        page.goto(f"{WEB}/sessions/{session_id}/delivery", wait_until="networkidle")
        page.wait_for_timeout(1500)
        dl_btn = page.get_by_role("button", name=re.compile("^Download$", re.I))
        step("the per-student Download control exists", dl_btn.count() > 0)

        if dl_btn.count():
            try:
                with page.expect_download(timeout=45000) as dl:
                    dl_btn.first.click()
                path = dl.value.path()
                head = Path(path).read_bytes()[:5] if path else b""
                step("the per-student report downloads as a PDF", head == b"%PDF-", str(head))
            except Exception as e:
                step("the per-student report downloads as a PDF", False, type(e).__name__)

        step("no failing API calls", not bad, "; ".join(bad[:3]))
        browser.close()

    print(f"\n{sum(ok)}/{len(ok)} counsellor checks passed")
    return 0 if all(ok) else 1


if __name__ == "__main__":
    sys.exit(main())
