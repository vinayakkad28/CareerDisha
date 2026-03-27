"""Aptitude test scoring for stream recommendation.

Scores 15 aptitude questions (5 numerical, 5 verbal, 5 spatial)
and converts to per-stream fitness scores.
"""

from __future__ import annotations

import json

from config import DATA_DIR

# Per-stream aptitude weights
STREAM_APTITUDE_WEIGHTS = {
    "Science (PCM)": {"numerical": 0.50, "spatial": 0.30, "verbal": 0.20},
    "Science (PCB)": {"verbal": 0.40, "numerical": 0.30, "spatial": 0.30},
    "Commerce": {"numerical": 0.50, "verbal": 0.40, "spatial": 0.10},
    "Arts/Humanities": {"verbal": 0.50, "spatial": 0.30, "numerical": 0.20},
}


def load_aptitude_questions() -> dict:
    """Load aptitude questions from JSON file."""
    path = DATA_DIR / "aptitude_questions.json"
    with open(path) as f:
        return json.load(f)


def get_questions_for_api() -> list[dict]:
    """Return questions without correct answers (safe for API response)."""
    data = load_aptitude_questions()
    questions = []
    for category, items in data["categories"].items():
        for q in items:
            questions.append({
                "id": q["id"],
                "text": q["text"],
                "text_hi": q.get("text_hi", ""),
                "options": q["options"],
                "category": category,
            })
    return questions



def score_aptitude(responses: dict | None) -> dict | None:
    """Score aptitude responses.

    Args:
        responses: dict like {"APT_N1": "B", "APT_V2": "C", ...}

    Returns None if no responses provided.
    Returns {"numerical": 0-100, "verbal": 0-100, "spatial": 0-100, "total": 0-100}
    """
    if not responses:
        return None

    # Single file read for both answer key and category map
    data = load_aptitude_questions()
    answer_key = {}
    category_map = {}
    for category, items in data["categories"].items():
        for q in items:
            answer_key[q["id"]] = q["correct"]
            category_map[q["id"]] = category

    # Count correct per category
    category_correct = {"numerical": 0, "verbal": 0, "spatial": 0}
    category_total = {"numerical": 0, "verbal": 0, "spatial": 0}

    for q_id, correct in answer_key.items():
        category = category_map[q_id]
        category_total[category] += 1
        student_answer = responses.get(q_id, "").strip().upper()
        if student_answer == correct:
            category_correct[category] += 1

    # Convert to percentages
    scores = {}
    for cat in ("numerical", "verbal", "spatial"):
        total = category_total[cat]
        if total > 0:
            scores[cat] = round((category_correct[cat] / total) * 100, 1)
        else:
            scores[cat] = 0.0

    # Weighted total
    scores["total"] = round(
        scores["numerical"] * 0.35 +
        scores["verbal"] * 0.35 +
        scores["spatial"] * 0.30,
        1,
    )

    return scores


def calculate_aptitude_stream_fit(aptitude_scores: dict | None) -> dict[str, float] | None:
    """Return per-stream aptitude fitness (0-100).

    Returns None if aptitude_scores is None.
    """
    if not aptitude_scores:
        return None

    result = {}
    for stream, weights in STREAM_APTITUDE_WEIGHTS.items():
        total = sum(
            aptitude_scores.get(cat, 50.0) * w
            for cat, w in weights.items()
        )
        result[stream] = round(total, 1)

    return result
