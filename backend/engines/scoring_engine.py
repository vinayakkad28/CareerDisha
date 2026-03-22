"""RIASEC Assessment Scoring Engine.

Takes ZipGrade CSV export + student info CSV and produces scored student profiles
with RIASEC scores, Holland Codes, and matched careers from the knowledge base.
"""

import json
from pathlib import Path
from typing import Optional

import pandas as pd

from config import (
    DATA_DIR,
    RIASEC_TYPES,
    RIASEC_TYPE_NAMES,
    ITEMS_PER_DIMENSION,
    LIKERT_MAP,
)
from database import SessionLocal
from models import Student


def load_riasec_item_map() -> dict:
    with open(DATA_DIR / "riasec_item_map.json") as f:
        return json.load(f)


def load_knowledge_base() -> list:
    kb_path = DATA_DIR / "career_knowledge_base.json"
    with open(kb_path) as f:
        data = json.load(f)
    # Support both flat array and categorized format
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and "careers" in data:
        return data["careers"]
    if isinstance(data, dict) and "categories" in data:
        careers = []
        for cat in data["categories"]:
            careers.extend(cat.get("careers", []))
        return careers
    return data


def calculate_riasec_scores(raw_responses: dict) -> dict:
    """Calculate RIASEC scores from raw Q1-Q74 responses.

    Returns dict with keys R, I, A, S, E, C (0-100 scale) and work_values dict.
    """
    item_map = load_riasec_item_map()

    # Accumulate scores per dimension
    dimension_scores: dict[str, list[int]] = {t: [] for t in RIASEC_TYPES}
    work_value_scores: list[int] = []

    for q_key, dimension in item_map.items():
        response = raw_responses.get(q_key, "C")  # Default to Neutral if missing
        score = LIKERT_MAP.get(response.upper(), 3)

        if dimension == "WV":
            work_value_scores.append(score)
        elif dimension in dimension_scores:
            dimension_scores[dimension].append(score)

    # Calculate normalized scores (0-100)
    riasec_scores = {}
    for dim_type in RIASEC_TYPES:
        scores = dimension_scores[dim_type]
        if scores:
            raw_sum = sum(scores)
            max_possible = len(scores) * 5  # Max is 5 per item
            normalized = round((raw_sum / max_possible) * 100, 1)
            riasec_scores[dim_type] = normalized
        else:
            riasec_scores[dim_type] = 0.0

    # Work values (8 items mapped to specific values)
    work_value_labels = [
        "security", "independence", "continuous_learning", "social_impact",
        "high_income", "creativity", "adventure", "structured_environment",
    ]
    work_values = {}
    for i, label in enumerate(work_value_labels):
        work_values[label] = work_value_scores[i] if i < len(work_value_scores) else 3

    return {
        "riasec_scores": riasec_scores,
        "work_values": work_values,
    }


def determine_holland_code(riasec_scores: dict) -> str:
    """Determine Holland Code (top 3 RIASEC types).

    Ties broken by conventional RIASEC order (R > I > A > S > E > C).
    """
    # Sort by score descending, then by RIASEC order for ties
    riasec_order = {t: i for i, t in enumerate(RIASEC_TYPES)}
    sorted_types = sorted(
        riasec_scores.items(),
        key=lambda x: (-x[1], riasec_order.get(x[0], 99)),
    )
    return "".join(t for t, _ in sorted_types[:3])


def match_careers(holland_code: str, knowledge_base: list, top_n: int = 10) -> list:
    """Match student's Holland Code against career profiles in the knowledge base.

    Scoring:
    - 3 points for each letter in career's riasec_code that matches student's Holland Code
    - Bonus: +2 if career's riasec_primary matches student's #1 type
    - Sort by total match score descending
    """
    student_types = list(holland_code)
    if not student_types:
        return []

    primary_type = student_types[0]
    scored_careers = []

    for career in knowledge_base:
        career_code = career.get("riasec_code", "")
        career_primary = career.get("riasec_primary", "")

        # Count overlapping letters
        overlap = sum(1 for c in career_code if c in student_types)
        match_score = overlap * 3  # 3 points per matching letter

        # Bonus for primary type match
        if career_primary == primary_type:
            match_score += 2

        # Bonus for exact code match
        if set(career_code) == set(holland_code):
            match_score += 3

        if match_score > 0:
            # Normalize to 0-100 scale (max possible: 3*3 + 2 + 3 = 14)
            normalized_score = min(round((match_score / 14) * 100), 100)
            match_type = "primary" if career_primary == primary_type else "secondary"
            scored_careers.append({
                "career_id": career.get("career_id", ""),
                "career_name": career.get("career_name", ""),
                "match_score": normalized_score,
                "match_type": match_type,
            })

    # Sort by match score descending
    scored_careers.sort(key=lambda x: -x["match_score"])
    return scored_careers[:top_n]


def score_all_students(session_id: int):
    """Score all students in a session: calculate RIASEC, determine Holland Code, match careers."""
    db = SessionLocal()
    try:
        kb = load_knowledge_base()
        students = db.query(Student).filter(
            Student.session_id == session_id,
            Student.report_status == "pending",
        ).all()

        for student in students:
            raw = student.riasec_raw_responses or {}
            if not raw:
                continue

            # Calculate scores
            result = calculate_riasec_scores(raw)
            riasec_scores = result["riasec_scores"]
            work_values = result["work_values"]

            # Determine Holland Code
            holland_code = determine_holland_code(riasec_scores)

            # Match careers
            matched = match_careers(holland_code, kb)

            # Update student record
            student.riasec_scores = riasec_scores
            student.holland_code = holland_code
            student.work_values = work_values
            student.matched_careers = matched
            student.report_status = "scored"

        # Update session status
        from models import Session
        session = db.query(Session).filter(Session.id == session_id).first()
        if session:
            session.status = "scored"

        db.commit()
    finally:
        db.close()
