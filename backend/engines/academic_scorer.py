"""Academic performance scoring for stream recommendation.

Converts self-reported academic marks into per-stream fitness scores
using subject-specific weightings.
"""

from __future__ import annotations

# Grade letter to percentage conversion
GRADE_MAP = {"A": 90, "B": 75, "C": 55, "D": 35, "E": 20, "F": 10}

# Per-stream subject weights
STREAM_WEIGHTS = {
    "Science (PCM)": {"maths": 0.50, "science": 0.30, "english": 0.20},
    "Science (PCB)": {"science": 0.50, "english": 0.30, "maths": 0.20},
    "Commerce": {"maths": 0.40, "english": 0.30, "social_studies": 0.30},
    "Arts/Humanities": {"english": 0.40, "social_studies": 0.40, "maths": 0.10, "science": 0.10},
}

# Canonical subject name aliases
SUBJECT_ALIASES = {
    "math": "maths", "mathematics": "maths",
    "sci": "science", "phy": "science", "physics": "science",
    "eng": "english", "language": "english",
    "sst": "social_studies", "social": "social_studies",
    "social studies": "social_studies", "history": "social_studies",
}


def _normalize_marks(academic_marks: dict) -> dict[str, float]:
    """Normalize subject names and convert grades to percentages."""
    result = {}
    for key, value in academic_marks.items():
        # Skip non-subject keys
        if key in ("overall_pct", "overall_percentage", "strongest_subject"):
            continue
        # Normalize subject name
        subject = key.lower().strip().replace(" ", "_")
        subject = SUBJECT_ALIASES.get(subject, subject)
        # Convert value
        if value is None:
            continue
        if isinstance(value, str):
            value = value.strip().upper()
            if value in GRADE_MAP:
                result[subject] = GRADE_MAP[value]
            else:
                try:
                    result[subject] = float(value)
                except ValueError:
                    continue
        elif isinstance(value, (int, float)):
            result[subject] = float(value)
    return result


def calculate_academic_fit(academic_marks: dict | None) -> dict[str, float] | None:
    """Return per-stream fitness score (0-100) based on academic marks.

    Returns None if academic_marks is None or has no usable data.
    """
    if not academic_marks:
        return None

    marks = _normalize_marks(academic_marks)
    if not marks:
        return None

    result = {}
    for stream, weights in STREAM_WEIGHTS.items():
        total = 0.0
        weight_sum = 0.0
        for subject, weight in weights.items():
            if subject in marks:
                total += marks[subject] * weight
                weight_sum += weight
        # Only score if we have at least one subject
        if weight_sum > 0:
            # Redistribute among available subjects
            result[stream] = round(total / weight_sum, 1)
        else:
            result[stream] = 50.0  # neutral default

    return result


def detect_academic_mismatches(
    riasec_top_stream: str | None,
    academic_marks: dict | None,
) -> list[str]:
    """Flag cases where interest and academic performance diverge.

    Returns list of warning strings.
    """
    if not riasec_top_stream or not academic_marks:
        return []

    marks = _normalize_marks(academic_marks)
    warnings = []

    stream_critical_subjects = {
        "Science (PCM)": [("maths", 50), ("science", 50)],
        "Science (PCB)": [("science", 50)],
        "Commerce": [("maths", 40)],
        "Arts/Humanities": [("english", 40)],
    }

    critical = stream_critical_subjects.get(riasec_top_stream, [])
    for subject, threshold in critical:
        if subject in marks and marks[subject] < threshold:
            warnings.append(
                f"Your interests align with {riasec_top_stream}, but your "
                f"{subject.replace('_', ' ').title()} performance ({marks[subject]}%) "
                f"may make this stream challenging. Consider strengthening "
                f"{subject.replace('_', ' ').title()} or explore alternative streams."
            )

    return warnings
