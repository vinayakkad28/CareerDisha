import io
import csv
import json
from datetime import date, datetime
from typing import Optional

import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, Request
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session as DBSession
from pydantic import BaseModel

from database import get_db
from models import Session, Student, School
from routers.auth import get_current_user
from rate_limit import limiter
from permissions import scope_query_by_school

router = APIRouter(dependencies=[Depends(get_current_user)])


def _parse_academic_marks(row: dict):
    """Parse optional academic marks columns from a CSV row."""
    marks = {}
    for key in ("maths_marks", "science_marks", "english_marks", "overall_percentage"):
        val = row.get(key, "").strip()
        if val:
            try:
                marks[key.replace("_marks", "").replace("_percentage", "_pct")] = float(val)
            except ValueError:
                pass
    return marks if marks else None


def _parse_self_efficacy(row: dict):
    """Parse optional self-efficacy columns (1-5 scale per domain)."""
    se = {}
    for domain in ("maths", "science", "english", "arts", "business", "social"):
        val = row.get(f"se_{domain}", "").strip()
        if val:
            try:
                se[domain] = int(val)
            except ValueError:
                pass
    return se if se else None


class SessionCreate(BaseModel):
    school_id: int
    session_date: date
    classes_assessed: list[int] = []
    counsellor_name: str = ""
    counsellor_certification: str = ""
    llm_provider: str = "anthropic"
    notes: str = ""


@router.get("")
def list_sessions(
    school_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: DBSession = Depends(get_db),
):
    query = db.query(Session).order_by(Session.session_date.desc())
    if school_id:
        query = query.filter(Session.school_id == school_id)
    if status:
        query = query.filter(Session.status == status)
    sessions = query.offset(skip).limit(limit).all()
    result = []
    for s in sessions:
        school = db.query(School).filter(School.id == s.school_id).first()
        result.append({
            **{c.name: getattr(s, c.name) for c in s.__table__.columns},
            "school_name": school.name if school else "",
            "school_city": school.city if school else "",
        })
    return result


@router.post("", status_code=201)
def create_session(session: SessionCreate, db: DBSession = Depends(get_db)):
    school = db.query(School).filter(School.id == session.school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    db_session = Session(**session.model_dump())
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return {c.name: getattr(db_session, c.name) for c in db_session.__table__.columns}


@router.get("/{session_id}")
def get_session(session_id: int, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    school = db.query(School).filter(School.id == session.school_id).first()
    students = db.query(Student).filter(Student.session_id == session_id).all()
    student_list = []
    for st in students:
        student_list.append({
            c.name: getattr(st, c.name)
            for c in st.__table__.columns
            if c.name != "report_content"  # Exclude large field from list view
        })
    return {
        **{c.name: getattr(session, c.name) for c in session.__table__.columns},
        "school_name": school.name if school else "",
        "school_code": school.code if school else "",
        "school_city": school.city if school else "",
        "students": student_list,
        "stats": {
            "total": len(students),
            "scored": sum(1 for s in students if s.report_status != "pending"),
            "reports_generated": sum(1 for s in students if s.report_status in ("report_generated", "qa_passed", "qa_flagged", "pdf_ready", "delivered")),
            "qa_passed": sum(1 for s in students if s.report_status in ("qa_passed", "pdf_ready", "delivered")),
            "qa_flagged": sum(1 for s in students if s.report_status == "qa_flagged"),
            "pdf_ready": sum(1 for s in students if s.report_status in ("pdf_ready", "delivered")),
            "delivered": sum(1 for s in students if s.report_status == "delivered"),
        },
    }


@router.post("/{session_id}/upload-csvs")
@limiter.limit("10/minute")
async def upload_csvs(
    request: Request,
    session_id: int,
    zipgrade_csv: UploadFile = File(...),
    student_info_csv: UploadFile = File(...),
    db: DBSession = Depends(get_db),
):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    logger = logging.getLogger(__name__)

    # Parse student info CSV
    info_raw = await student_info_csv.read()
    try:
        info_content = info_raw.decode("utf-8")
    except UnicodeDecodeError:
        info_content = info_raw.decode("latin-1")
    info_reader = csv.DictReader(io.StringIO(info_content))
    student_info_map = {}
    parse_errors = []
    for row_num, row in enumerate(info_reader, start=2):
        sid = row.get("student_id", "").strip()
        if not sid:
            parse_errors.append(f"Row {row_num}: missing student_id")
            continue
        try:
            class_val = row.get("class", row.get("class_level", "10")).strip()
            class_level = int(class_val) if class_val else 10
            if class_level not in (9, 10, 11, 12):
                parse_errors.append(f"Row {row_num} (ID {sid}): invalid class '{class_val}', defaulting to 10")
                class_level = 10
        except (ValueError, TypeError):
            parse_errors.append(f"Row {row_num} (ID {sid}): non-numeric class '{row.get('class', '')}', defaulting to 10")
            class_level = 10
        student_info_map[sid] = {
            "name": row.get("name", "").strip(),
            "class_level": class_level,
            "section": row.get("section", "").strip(),
            "parent_name": row.get("parent_name", "").strip(),
            "parent_phone": row.get("parent_phone", "").strip(),
            # Section D: Class 10 stream preference (optional columns)
            "stream_pref_parent": row.get("stream_pref_parent", "").strip(),
            "stream_pref_student": row.get("stream_pref_student", "").strip(),
            "career_concern": row.get("career_concern", "").strip(),
            # Academic marks (optional)
            "academic_marks": _parse_academic_marks(row),
            # Socioeconomic context (Layer 3)
            "gender": row.get("gender", "").strip().lower(),
            "family_income": row.get("family_income", "").strip(),
            "location_type": row.get("location_type", "").strip(),
            "parental_education": row.get("parental_education", "").strip(),
            "first_gen_learner": row.get("first_gen_learner", "").strip().lower() in ("yes", "true", "1"),
            # Self-efficacy (Layer 2 supplement)
            "self_efficacy": _parse_self_efficacy(row),
        }

    # Parse ZipGrade CSV
    zg_raw = await zipgrade_csv.read()
    try:
        zg_content = zg_raw.decode("utf-8")
    except UnicodeDecodeError:
        zg_content = zg_raw.decode("latin-1")
    zg_reader = csv.DictReader(io.StringIO(zg_content))
    students_created = 0

    for row in zg_reader:
        # ZipGrade uses "StudentID" or "Student ID" column
        sid = row.get("StudentID", row.get("Student ID", row.get("student_id", ""))).strip()
        info = student_info_map.get(sid, {})

        # Extract Q1-Q74 responses
        responses = {}
        for i in range(1, 75):
            key = f"Q{i}"
            alt_key = f"q{i}"
            val = row.get(key, row.get(alt_key, "")).strip().upper()
            if val in ("A", "B", "C", "D", "E"):
                responses[key] = val

        if not responses:
            continue

        name = info.get("name", row.get("LastName", "") + " " + row.get("FirstName", "")).strip()
        if not name or name == " ":
            name = f"Student {sid}"

        student = Student(
            session_id=session_id,
            student_id_external=sid,
            name=name,
            class_level=info.get("class_level", 10),
            section=info.get("section", ""),
            parent_name=info.get("parent_name", ""),
            parent_phone=info.get("parent_phone", ""),
            riasec_raw_responses=responses,
            stream_pref_parent=info.get("stream_pref_parent", ""),
            stream_pref_student=info.get("stream_pref_student", ""),
            career_concern=info.get("career_concern", ""),
            academic_marks=info.get("academic_marks"),
            gender=info.get("gender", ""),
            family_income=info.get("family_income", ""),
            location_type=info.get("location_type", ""),
            parental_education=info.get("parental_education", ""),
            first_gen_learner=info.get("first_gen_learner"),
            self_efficacy=info.get("self_efficacy"),
            report_status="pending",
        )
        db.add(student)
        students_created += 1

    # Update session stats
    session.total_students = students_created
    classes = list(set(
        info.get("class_level", 10) for info in student_info_map.values()
    ))
    if classes:
        session.classes_assessed = sorted(classes)

    if students_created == 0:
        raise HTTPException(status_code=400, detail="No valid students found in the uploaded CSVs. Check column names and response format.")

    db.commit()
    logger.info(f"Session {session_id}: uploaded {students_created} students, {len(parse_errors)} warnings")
    result = {"students_created": students_created, "message": f"Uploaded {students_created} students"}
    if parse_errors:
        result["warnings"] = parse_errors[:20]  # Cap at 20 to avoid huge responses
    return result


@router.post("/{session_id}/score")
def score_session(session_id: int, background_tasks: BackgroundTasks, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    from engines.scoring_engine import score_all_students
    score_all_students(session_id)
    return {"message": "Scoring complete"}


@router.post("/{session_id}/generate")
@limiter.limit("2/5minutes")
def generate_reports(
    request: Request,
    session_id: int,
    background_tasks: BackgroundTasks,
    db: DBSession = Depends(get_db),
):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Idempotency: prevent duplicate generation
    if session.status == "generating" and session.generation_started_at:
        elapsed = (datetime.now() - session.generation_started_at).total_seconds()
        if elapsed < 1800:  # 30 minutes
            raise HTTPException(status_code=409, detail="Report generation already in progress")
        # If > 30 min, assume crashed — allow retry

    session.status = "generating"
    session.generation_started_at = datetime.now()
    db.commit()

    from tasks.batch_processor import run_report_generation
    background_tasks.add_task(run_report_generation, session_id, session.llm_provider)
    return {"message": "Report generation started in background"}


@router.post("/{session_id}/qa")
def run_qa(session_id: int, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    from engines.qa_checker import run_qa_checks
    result = run_qa_checks(session_id)
    session.status = "qa_review"
    db.commit()
    return result


@router.post("/{session_id}/pdf")
def generate_pdfs(session_id: int, background_tasks: BackgroundTasks, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    from tasks.batch_processor import run_pdf_generation
    background_tasks.add_task(run_pdf_generation, session_id)
    return {"message": "PDF generation started in background"}


@router.get("/{session_id}/download")
def download_all_pdfs(session_id: int, db: DBSession = Depends(get_db)):
    import zipfile
    from pathlib import Path

    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    students = db.query(Student).filter(
        Student.session_id == session_id,
        Student.pdf_path != "",
    ).all()

    if not students:
        raise HTTPException(status_code=404, detail="No PDFs found for this session")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for student in students:
            pdf_path = Path(student.pdf_path)
            if pdf_path.exists():
                zf.write(pdf_path, pdf_path.name)

    zip_buffer.seek(0)
    school = db.query(School).filter(School.id == session.school_id).first()
    filename = f"{school.code if school else 'session'}_{session_id}_reports.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/{session_id}/school-summary")
def school_summary(session_id: int, db: DBSession = Depends(get_db)):
    """Generate school summary report — aggregate data for the principal."""
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    school = db.query(School).filter(School.id == session.school_id).first()
    students = db.query(Student).filter(Student.session_id == session_id).all()

    if not students:
        raise HTTPException(status_code=404, detail="No students in this session")

    # Aggregate RIASEC data per class
    class_data = {}
    stream_counts = {"Science (PCM)": 0, "Science (PCB)": 0, "Commerce": 0, "Arts/Humanities": 0, "Undecided": 0}

    for s in students:
        cls = s.class_level
        if cls not in class_data:
            class_data[cls] = {"count": 0, "scores": {t: [] for t in "RIASEC"}}
        class_data[cls]["count"] += 1
        scores = s.riasec_scores or {}
        for t in "RIASEC":
            if t in scores:
                class_data[cls]["scores"][t].append(scores[t])

        # Determine stream leaning from Holland code
        if s.holland_code:
            primary = s.holland_code[0] if s.holland_code else ""
            if primary in ("R", "I"):
                stream_counts["Science (PCM)"] += 1
            elif primary == "S":
                stream_counts["Science (PCB)"] += 1
            elif primary in ("E", "C"):
                stream_counts["Commerce"] += 1
            elif primary == "A":
                stream_counts["Arts/Humanities"] += 1
            else:
                stream_counts["Undecided"] += 1

    # Calculate averages per class
    class_summary = {}
    for cls, data in sorted(class_data.items()):
        avg_scores = {}
        for t in "RIASEC":
            vals = data["scores"][t]
            avg_scores[t] = round(sum(vals) / len(vals), 1) if vals else 0
        class_summary[cls] = {
            "count": data["count"],
            "average_scores": avg_scores,
        }

    # Top careers across all students
    career_freq = {}
    for s in students:
        for mc in (s.matched_careers or [])[:3]:
            cid = mc.get("career_name", mc.get("career_id", ""))
            career_freq[cid] = career_freq.get(cid, 0) + 1
    top_careers = sorted(career_freq.items(), key=lambda x: -x[1])[:10]

    consented = sum(1 for s in students if s.consent_obtained)

    return {
        "school_name": school.name if school else "",
        "school_code": school.code if school else "",
        "city": school.city if school else "",
        "session_date": session.session_date.isoformat() if session.session_date else "",
        "counsellor_name": session.counsellor_name,
        "total_students": len(students),
        "classes_assessed": sorted(class_data.keys()),
        "class_summary": class_summary,
        "stream_distribution": stream_counts,
        "top_careers": [{"career": c, "count": n} for c, n in top_careers],
        "consent_status": {"consented": consented, "total": len(students)},
        "reports_generated": sum(1 for s in students if s.report_status not in ("pending", "scored")),
        "pdfs_ready": sum(1 for s in students if s.report_status in ("pdf_ready", "delivered")),
        "delivered": sum(1 for s in students if s.delivery_status == "delivered"),
    }


@router.get("/{session_id}/compliance-certificate")
def compliance_certificate(session_id: int, db: DBSession = Depends(get_db)):
    """Generate data for a CBSE compliance certificate."""
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    school = db.query(School).filter(School.id == session.school_id).first()
    student_count = db.query(Student).filter(Student.session_id == session_id).count()
    consented = db.query(Student).filter(
        Student.session_id == session_id, Student.consent_obtained == True
    ).count()
    reports_delivered = db.query(Student).filter(
        Student.session_id == session_id, Student.delivery_status == "delivered"
    ).count()

    return {
        "certificate_type": "Career Counselling Session Certificate",
        "school_name": school.name if school else "",
        "school_code": school.code if school else "",
        "school_board": school.board if school else "CBSE",
        "city": school.city if school else "",
        "session_date": session.session_date.isoformat() if session.session_date else "",
        "counsellor_name": session.counsellor_name,
        "classes_assessed": session.classes_assessed,
        "total_students_assessed": student_count,
        "parental_consent_obtained": consented,
        "reports_delivered": reports_delivered,
        "assessment_tool": "RIASEC Career Interest Inventory (74 items)",
        "report_method": "AI-assisted analysis reviewed by qualified counsellor",
        "compliance_note": "This session was conducted in compliance with CBSE Affiliation Bye-Laws Clause 2.4.12 and NEP 2020 career guidance requirements.",
        "generated_at": datetime.now().isoformat(),
    }


@router.get("/{session_id}/compliance-certificate/pdf")
def compliance_certificate_pdf(session_id: int, db: DBSession = Depends(get_db)):
    """Generate and download CBSE compliance certificate as PDF."""
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    school = db.query(School).filter(School.id == session.school_id).first()
    student_count = db.query(Student).filter(Student.session_id == session_id).count()
    consented = db.query(Student).filter(
        Student.session_id == session_id, Student.consent_obtained == True
    ).count()
    reports_done = db.query(Student).filter(
        Student.session_id == session_id,
        Student.report_status.in_(["pdf_ready", "delivered"]),
    ).count()
    delivered = db.query(Student).filter(
        Student.session_id == session_id, Student.delivery_status == "delivered"
    ).count()

    session_date_str = session.session_date.strftime("%d %B %Y") if session.session_date else ""
    session_date_short = session.session_date.strftime("%Y%m%d") if session.session_date else ""

    from engines.compliance_generator import generate_compliance_pdf
    pdf_path = generate_compliance_pdf(
        school_name=school.name if school else "",
        school_code=school.code if school else "",
        school_city=school.city if school else "",
        school_board=school.board if school else "CBSE",
        session_date_str=session_date_str,
        session_date_short=session_date_short,
        counsellor_name=session.counsellor_name or "",
        counsellor_certification=session.counsellor_certification or "",
        classes_assessed=", ".join(f"Class {c}" for c in (session.classes_assessed or [])),
        total_students=student_count,
        reports_done=reports_done,
        delivered=delivered,
        consent_count=consented,
        session_id=session_id,
    )

    return FileResponse(
        str(pdf_path),
        media_type="application/pdf",
        filename=f"CBSE_Compliance_Certificate_{school.code if school else ''}_{session_date_short}.pdf",
    )
