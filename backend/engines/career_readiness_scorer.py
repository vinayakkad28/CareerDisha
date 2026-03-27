"""Career Readiness scoring.

5 Likert items measuring decision confidence and career preparedness.
Score influences report framing and caps recommendation confidence.
"""

from __future__ import annotations

import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Likert mapping
_LIKERT = {"A": 1, "B": 2, "C": 3, "D": 4, "E": 5}

# Readiness level thresholds
READINESS_LEVELS = [
    (75, "decision_ready"),
    (50, "exploring"),
    (25, "early_stage"),
    (0,  "undecided"),
]

READINESS_LABELS = {
    "decision_ready": "Decision Ready",
    "exploring": "Exploring",
    "early_stage": "Early Stage",
    "undecided": "Undecided",
}


def load_career_readiness_questions() -> list[dict]:
    """Load career readiness questions from JSON."""
    path = DATA_DIR / "career_readiness_questions.json"
    with open(path) as f:
        data = json.load(f)
    return data["items"]


def get_career_readiness_for_api() -> dict:
    """Return questions safe for API response."""
    items = load_career_readiness_questions()
    return {"items": items, "total": len(items)}


def score_career_readiness(responses: dict | None) -> tuple[int | None, str]:
    """Score career readiness responses.

    Input: {"CR1": "D", "CR2": "B", ...} or {"CR1": 4, "CR2": 2, ...}
    Output: (score 0-100, level string)

    Raw sum range: 5-25. Normalized: ((raw - 5) / 20) * 100.
    """
    if not responses:
        return None, ""

    total = 0
    count = 0
    for item_id in ("CR1", "CR2", "CR3", "CR4", "CR5"):
        raw = responses.get(item_id)
        if raw is None:
            continue
        if isinstance(raw, str):
            total += _LIKERT.get(raw.upper(), 3)
        else:
            total += int(raw)
        count += 1

    if count == 0:
        return None, ""

    # Scale partial responses proportionally
    if count < 5:
        total = round(total * 5 / count)

    score = round(((total - 5) / 20) * 100)
    score = max(0, min(100, score))

    level = "undecided"
    for threshold, lvl in READINESS_LEVELS:
        if score >= threshold:
            level = lvl
            break

    return score, level
