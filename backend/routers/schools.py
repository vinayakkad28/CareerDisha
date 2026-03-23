import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from database import get_db
from models import School, Session as SessionModel
from routers.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_user)])


class SchoolCreate(BaseModel):
    name: str
    code: str
    city: str
    board: str = "CBSE"
    contact_person: str = ""
    contact_phone: str = ""


class SchoolUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    board: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None


class SchoolResponse(BaseModel):
    id: int
    name: str
    code: str
    city: str
    board: str
    contact_person: str
    contact_phone: str
    total_sessions: int = 0
    total_students: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("")
def list_schools(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    schools = db.query(School).order_by(School.created_at.desc()).offset(skip).limit(limit).all()
    result = []
    for s in schools:
        session_count = db.query(SessionModel).filter(SessionModel.school_id == s.id).count()
        total_students = sum(
            sess.total_students for sess in db.query(SessionModel).filter(SessionModel.school_id == s.id).all()
        )
        result.append({
            **{c.name: getattr(s, c.name) for c in s.__table__.columns},
            "total_sessions": session_count,
            "total_students": total_students,
        })
    return result


@router.post("", status_code=201)
def create_school(school: SchoolCreate, db: Session = Depends(get_db)):
    existing = db.query(School).filter(School.code == school.code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"School with code '{school.code}' already exists")
    db_school = School(**school.model_dump())
    db.add(db_school)
    db.commit()
    db.refresh(db_school)
    return {c.name: getattr(db_school, c.name) for c in db_school.__table__.columns}


@router.get("/{school_id}")
def get_school(school_id: int, db: Session = Depends(get_db)):
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    sessions = db.query(SessionModel).filter(SessionModel.school_id == school_id).order_by(SessionModel.session_date.desc()).all()
    return {
        **{c.name: getattr(school, c.name) for c in school.__table__.columns},
        "sessions": [
            {c.name: getattr(s, c.name) for c in s.__table__.columns}
            for s in sessions
        ],
    }


@router.put("/{school_id}")
def update_school(school_id: int, updates: SchoolUpdate, db: Session = Depends(get_db)):
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(school, field, value)
    db.commit()
    db.refresh(school)
    return {c.name: getattr(school, c.name) for c in school.__table__.columns}


@router.delete("/{school_id}")
def delete_school(school_id: int, db: Session = Depends(get_db)):
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    db.delete(school)
    db.commit()
    return {"detail": "School deleted"}
