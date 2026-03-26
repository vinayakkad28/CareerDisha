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


# Attention-check items embedded in future OMR forms (Q75-Q77).
# Each maps to the expected correct answer (the question text instructs the student to pick it).
ATTENTION_CHECK_ITEMS = {
    "Q75": "C",  # "For this question, please select option C"
    "Q76": "A",  # "For this question, please select option A"
    "Q77": "D",  # "For this question, please select option D"
}
ATTENTION_CHECK_FAIL_THRESHOLD = 2  # flag if 2+ checks failed


def detect_attention_issues(raw_responses: dict) -> list[str]:
    """Detect signs of random or careless responding.

    Returns a list of warning strings (empty = no issues detected).
    """
    warnings = []
    valid_responses = [v for v in raw_responses.values() if isinstance(v, str) and v.upper() in "ABCDE"]
    if not valid_responses:
        return warnings

    # 1. Explicit attention-check failures (Q75-Q77 if present on the form)
    ac_failures = 0
    for q_key, expected in ATTENTION_CHECK_ITEMS.items():
        if q_key in raw_responses:
            actual = str(raw_responses[q_key]).upper()
            if actual != expected:
                ac_failures += 1
    if ac_failures >= ATTENTION_CHECK_FAIL_THRESHOLD:
        warnings.append(f"[ATTENTION] Failed {ac_failures}/{len(ATTENTION_CHECK_ITEMS)} attention-check items — responses may be unreliable")

    # 2. Near-identical responses: > 80% of answers are the same letter
    if len(valid_responses) >= 20:
        from collections import Counter
        most_common_letter, most_common_count = Counter(valid_responses).most_common(1)[0]
        pct = most_common_count / len(valid_responses)
        if pct >= 0.80:
            warnings.append(f"[ATTENTION] {pct:.0%} of responses are '{most_common_letter}' — possible random/careless responding")

    # 3. Long consecutive run of same letter (≥ 15 in a row)
    max_run = 1
    current_run = 1
    for i in range(1, len(valid_responses)):
        if valid_responses[i] == valid_responses[i - 1]:
            current_run += 1
            max_run = max(max_run, current_run)
        else:
            current_run = 1
    if max_run >= 15:
        warnings.append(f"[ATTENTION] Run of {max_run} identical consecutive responses detected — possible patterned responding")

    return warnings


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

            # Attention-check detection — append warnings to qa_flags
            attention_warnings = detect_attention_issues(raw)
            if attention_warnings:
                existing_flags = student.qa_flags or []
                student.qa_flags = existing_flags + attention_warnings

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
