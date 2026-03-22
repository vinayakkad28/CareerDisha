import io
import csv
import json
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session as DBSession
from pydantic import BaseModel

from database import get_db
from models import Session, Student, School

router = APIRouter()


class SessionCreate(BaseModel):
    school_id: int
    session_date: date
    classes_assessed: list[int] = []
    counsellor_name: str = ""
    llm_provider: str = "anthropic"
    notes: str = ""


@router.get("")
def list_sessions(
    school_id: Optional[int] = None,
    status: Optional[str] = None,
    db: DBSession = Depends(get_db),
):
    query = db.query(Session).order_by(Session.session_date.desc())
    if school_id:
        query = query.filter(Session.school_id == school_id)
    if status:
        query = query.filter(Session.status == status)
    sessions = query.all()
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
async def upload_csvs(
    session_id: int,
    zipgrade_csv: UploadFile = File(...),
    student_info_csv: UploadFile = File(...),
    db: DBSession = Depends(get_db),
):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Parse student info CSV
    info_content = (await student_info_csv.read()).decode("utf-8")
    info_reader = csv.DictReader(io.StringIO(info_content))
    student_info_map = {}
    for row in info_reader:
        sid = row.get("student_id", "").strip()
        student_info_map[sid] = {
            "name": row.get("name", "").strip(),
            "class_level": int(row.get("class", row.get("class_level", "10"))),
            "section": row.get("section", "").strip(),
            "parent_name": row.get("parent_name", "").strip(),
            "parent_phone": row.get("parent_phone", "").strip(),
        }

    # Parse ZipGrade CSV
    zg_content = (await zipgrade_csv.read()).decode("utf-8")
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

    db.commit()
    return {"students_created": students_created, "message": f"Uploaded {students_created} students"}


@router.post("/{session_id}/score")
def score_session(session_id: int, background_tasks: BackgroundTasks, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    from engines.scoring_engine import score_all_students
    score_all_students(session_id)
    return {"message": "Scoring complete"}


@router.post("/{session_id}/generate")
def generate_reports(
    session_id: int,
    background_tasks: BackgroundTasks,
    db: DBSession = Depends(get_db),
):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.status = "generating"
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
