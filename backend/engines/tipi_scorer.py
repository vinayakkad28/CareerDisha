"""Ten-Item Personality Inventory (TIPI) scoring.

TIPI reliability is lower than full NEO PI — present scores as
broad tendencies, not precise measurements.

Big Five traits: O(penness), C(onscientiousness), E(xtraversion),
A(greeableness), N(euroticism).
"""

from __future__ import annotations

import json

from config import DATA_DIR, LIKERT_MAP

# TIPI item metadata
TIPI_ITEMS = [
    {"id": "BF1",  "trait": "E", "reverse": False},
    {"id": "BF2",  "trait": "A", "reverse": True},
    {"id": "BF3",  "trait": "C", "reverse": False},
    {"id": "BF4",  "trait": "N", "reverse": False},
    {"id": "BF5",  "trait": "O", "reverse": False},
    {"id": "BF6",  "trait": "E", "reverse": True},
    {"id": "BF7",  "trait": "A", "reverse": False},
    {"id": "BF8",  "trait": "C", "reverse": True},
    {"id": "BF9",  "trait": "N", "reverse": True},
    {"id": "BF10", "trait": "O", "reverse": True},
]

# Per-stream personality weights
STREAM_PERSONALITY_WEIGHTS = {
    "Science (PCM)": {"C": 0.40, "O": 0.35, "A_inv": 0.10, "E": 0.15},
    "Science (PCB)": {"A": 0.35, "C": 0.35, "O": 0.20, "E": 0.10},
    "Commerce": {"E": 0.40, "C": 0.30, "A": 0.20, "O": 0.10},
    "Arts/Humanities": {"O": 0.45, "A": 0.30, "E": 0.15, "C_inv": 0.10},
}


def load_tipi_questions() -> list[dict]:
    """Load TIPI questions from JSON (without scoring metadata)."""
    path = DATA_DIR / "tipi_questions.json"
    with open(path) as f:
        data = json.load(f)
    return data["items"]


def get_tipi_for_api() -> dict:
    """Return TIPI items safe for API response (no reverse-scoring info)."""
    path = DATA_DIR / "tipi_questions.json"
    with open(path) as f:
        data = json.load(f)
    items = []
    for item in data["items"]:
        items.append({
            "id": item["id"],
            "text": item["text"],
            "text_hi": item.get("text_hi", ""),
        })
    return {
        "preamble": data.get("preamble", "I see myself as someone who is..."),
        "preamble_hi": data.get("preamble_hi", ""),
        "items": items,
    }


def score_tipi(responses: dict | None) -> dict[str, float] | None:
    """Score TIPI responses.

    Input: {"BF1": "D", ...} or {"BF1": 4, ...}
    Output: {"O": 60, "C": 85, "E": 50, "A": 72, "N": 30} each 0-100.

    Each trait has 2 items (one straight, one reverse).
    Reverse-scored item: score = 6 - raw_score.
    Trait score = mean of 2 items, then scaled to 0-100: ((mean - 1) / 4) * 100.
    """
    if not responses:
        return None

    trait_scores: dict[str, list[float]] = {"O": [], "C": [], "E": [], "A": [], "N": []}

    for item in TIPI_ITEMS:
        raw = responses.get(item["id"])
        if raw is None:
            continue

        # Convert letter to number if needed
        if isinstance(raw, str):
            score = LIKERT_MAP.get(raw.upper(), 3)
        else:
            score = int(raw)

        # Reverse-score if needed
        if item["reverse"]:
            score = 6 - score

        trait_scores[item["trait"]].append(score)

    # Calculate trait percentages
    result = {}
    for trait, scores in trait_scores.items():
        if scores:
            mean = sum(scores) / len(scores)
            result[trait] = round(((mean - 1) / 4) * 100, 1)
        else:
            result[trait] = 50.0  # neutral default

    return result


def calculate_tipi_stream_fit(big_five: dict | None) -> dict[str, float] | None:
    """Map Big Five to per-stream fit. Returns None if no data.

    High N (Neuroticism) does NOT change stream recommendation —
    it is a counsellor alert, not a stream signal.
    """
    if not big_five:
        return None

    result = {}
    for stream, weights in STREAM_PERSONALITY_WEIGHTS.items():
        total = 0.0
        for trait_key, weight in weights.items():
            if trait_key.endswith("_inv"):
                # Inverted trait: use (100 - score)
                base_trait = trait_key.replace("_inv", "")
                total += (100 - big_five.get(base_trait, 50)) * weight
            else:
                total += big_five.get(trait_key, 50) * weight
        result[stream] = round(total, 1)

    return result


def get_neuroticism_warning(big_five: dict | None) -> str | None:
    """Return counsellor alert if neuroticism is high."""
    if not big_five:
        return None
    n_score = big_five.get("N", 50)
    if n_score > 70:
        return (
            f"Student shows elevated anxiety tendency ({n_score}%). "
            "This is common in board exam culture and does not affect stream suitability. "
            "Consider confidence-building activities and stress management support."
        )
    return None
