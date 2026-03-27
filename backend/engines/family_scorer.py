"""Family context feasibility scoring for stream recommendation.

Evaluates practical feasibility of each stream based on coaching
affordability, geographic mobility, family income, and parental priorities.

IMPORTANT: Low feasibility = "harder path given circumstances", NOT "bad choice".
The report should surface scholarship/free coaching alternatives for
low-feasibility high-interest streams.
"""

from __future__ import annotations


# Base feasibility — all streams start at 70 (moderately feasible)
BASE_SCORE = 70.0


def calculate_family_feasibility(family_context: dict | None) -> dict[str, float] | None:
    """Return per-stream feasibility score (0-100) based on family context.

    Returns None if family_context is None or empty.
    """
    if not family_context:
        return None

    # Check if there's any actual data
    has_data = any(
        family_context.get(k)
        for k in ("coaching_affordability", "mobility_willingness", "family_income",
                   "parent_primary_concern", "income_bracket", "location_type")
    )
    if not has_data:
        return None

    scores = {
        "Science (PCM)": BASE_SCORE,
        "Science (PCB)": BASE_SCORE,
        "Commerce": BASE_SCORE,
        "Arts/Humanities": BASE_SCORE,
    }

    coaching = family_context.get("coaching_affordability", "")
    mobility = family_context.get("mobility_willingness", "")
    income = family_context.get("family_income", family_context.get("income_bracket", ""))
    concern = family_context.get("parent_primary_concern", "")
    location = family_context.get("location_type", "")

    # Coaching affordability — PCM/PCB rely heavily on coaching (JEE/NEET)
    if coaching == "no":
        scores["Science (PCM)"] -= 15
        scores["Science (PCB)"] -= 15
        scores["Commerce"] -= 5
        # Arts typically needs less coaching
    elif coaching == "yes_difficult":
        scores["Science (PCM)"] -= 8
        scores["Science (PCB)"] -= 8
        scores["Commerce"] -= 3

    # Mobility — if unwilling to move + rural, metro-dependent streams harder
    if mobility == "no" and location in ("rural", "Rural"):
        scores["Science (PCM)"] -= 10
        scores["Science (PCB)"] -= 10
        scores["Commerce"] -= 5
    elif mobility == "no":
        scores["Science (PCM)"] -= 5
        scores["Science (PCB)"] -= 5

    # Family income impact
    if income in ("below_3l", "Below \u20b93L"):
        # Private engineering/medical very expensive
        scores["Science (PCM)"] -= 10
        scores["Science (PCB)"] -= 10
        scores["Commerce"] -= 5
        # But government colleges are affordable — don't zero out
    elif income in ("3_10l", "\u20b93-10L"):
        scores["Science (PCM)"] -= 5
        scores["Science (PCB)"] -= 5

    # Parent primary concern boosts
    if concern == "job_security":
        scores["Science (PCM)"] += 10
        scores["Commerce"] += 10
    elif concern == "high_salary":
        scores["Science (PCM)"] += 10
        scores["Commerce"] += 5
    elif concern == "passion":
        scores["Arts/Humanities"] += 10
    elif concern == "social_status":
        scores["Science (PCM)"] += 10
        scores["Science (PCB)"] += 10

    # Clamp all scores to 10-100 (never zero — always some path)
    return {k: round(max(10.0, min(100.0, v)), 1) for k, v in scores.items()}
