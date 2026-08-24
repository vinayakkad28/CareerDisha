"""Multi-dimensional stream recommendation engine.

Combines RIASEC interest scores with academic performance, aptitude test
results, and family feasibility context to produce a weighted per-stream
recommendation with transparent breakdowns.
"""

from __future__ import annotations

from config import STREAM_DIMENSION_WEIGHTS


# ── Per-stream interest conversion from RIASEC ─────────────────

def riasec_to_stream_interest(riasec_scores: dict) -> dict[str, float]:
    """Convert 6-dimension RIASEC scores (0-100) to per-stream interest fit.

    Returns {"Science (PCM)": X, "Science (PCB)": Y, "Commerce": Z, "Arts/Humanities": W}
    """
    R = riasec_scores.get("R", 0)
    I = riasec_scores.get("I", 0)
    A = riasec_scores.get("A", 0)
    S = riasec_scores.get("S", 0)
    E = riasec_scores.get("E", 0)
    C = riasec_scores.get("C", 0)

    return {
        "Science (PCM)": round((R + I) / 2, 1),
        "Science (PCB)": round((I + S) / 2, 1),
        "Commerce": round((E + C) / 2, 1),
        "Arts/Humanities": round((A + S) / 2, 1),
    }


# ── Core recommendation engine ────────────────────────────────

def recommend_stream(
    riasec_scores: dict,
    academic_fit: dict[str, float] | None = None,
    aptitude_fit: dict[str, float] | None = None,
    personality_fit: dict[str, float] | None = None,
    feasibility_fit: dict[str, float] | None = None,
    self_efficacy: dict | None = None,
    career_readiness_score: int | None = None,
) -> dict:
    """Multi-dimensional stream recommendation (up to 5 dimensions).

    Args:
        riasec_scores: dict with keys R,I,A,S,E,C (0-100 each)
        academic_fit: per-stream academic fitness from academic_scorer (optional)
        aptitude_fit: per-stream aptitude fitness from aptitude_scorer (optional)
        personality_fit: per-stream personality fit from tipi_scorer (optional)
        feasibility_fit: per-stream feasibility from family_scorer (optional)
        self_efficacy: raw SE scores for mismatch detection (optional)
        career_readiness_score: 0-100, caps confidence if low (optional)

    Returns dict with:
        recommended_stream: str | None
        confidence: "High" | "Moderate" | "Low" | "Insufficient"
        career_readiness_level: str
        all_streams: list of per-stream breakdowns (sorted by total desc)
        dimension_count: how many dimensions had data (1-5)
        dimension_agreement: how many dimensions agree on top stream
        explanation: human-readable message
        warnings: list of cross-dimensional mismatch warnings
        data_completeness: which dimensions were available
    """
    from routers.quiz import is_flat_profile

    streams = ["Science (PCM)", "Science (PCB)", "Commerce", "Arts/Humanities"]

    # Check flat profile
    if is_flat_profile(riasec_scores):
        return _flat_result(streams)

    # Gather available dimensions
    interest_scores = riasec_to_stream_interest(riasec_scores)

    dimensions = {"interest": interest_scores}
    if academic_fit is not None:
        dimensions["academic"] = academic_fit
    if aptitude_fit is not None:
        dimensions["aptitude"] = aptitude_fit
    if personality_fit is not None:
        dimensions["personality"] = personality_fit
    if feasibility_fit is not None:
        dimensions["feasibility"] = feasibility_fit

    dimension_count = len(dimensions)
    data_completeness = {
        "interest": True,
        "academic": academic_fit is not None,
        "aptitude": aptitude_fit is not None,
        "personality": personality_fit is not None,
        "feasibility": feasibility_fit is not None,
    }

    # Career readiness level
    cr_level = ""
    if career_readiness_score is not None:
        if career_readiness_score >= 75:
            cr_level = "decision_ready"
        elif career_readiness_score >= 50:
            cr_level = "exploring"
        elif career_readiness_score >= 25:
            cr_level = "early_stage"
        else:
            cr_level = "undecided"

    # Redistribute weights proportionally among available dimensions
    available_weights = {k: STREAM_DIMENSION_WEIGHTS[k] for k in dimensions}
    total_weight = sum(available_weights.values())
    normalized_weights = {k: v / total_weight for k, v in available_weights.items()}

    # Calculate weighted total per stream
    stream_scores = []
    for stream in streams:
        total = 0.0
        for dim_name, dim_scores in dimensions.items():
            score = dim_scores.get(stream, 50.0)
            weight = normalized_weights[dim_name]
            total += score * weight

        stream_scores.append({
            "stream": stream,
            "total_score": round(total, 1),
            "interest_score": round(interest_scores.get(stream, 0), 1),
            "academic_score": round(academic_fit[stream], 1) if academic_fit and stream in academic_fit else None,
            "aptitude_score": round(aptitude_fit[stream], 1) if aptitude_fit and stream in aptitude_fit else None,
            "personality_score": round(personality_fit[stream], 1) if personality_fit and stream in personality_fit else None,
            "feasibility_score": round(feasibility_fit[stream], 1) if feasibility_fit and stream in feasibility_fit else None,
            "flags": [],
        })

    # Sort by total score descending
    stream_scores.sort(key=lambda x: -x["total_score"])

    # Determine which stream each dimension independently ranks #1
    dim_winners = {}
    for dim_name, dim_scores in dimensions.items():
        top_stream = max(dim_scores, key=dim_scores.get)
        dim_winners[dim_name] = top_stream

    top_stream = stream_scores[0]["stream"]
    dimension_agreement = sum(1 for w in dim_winners.values() if w == top_stream)

    # Confidence based on dimension agreement + count
    gap = stream_scores[0]["total_score"] - stream_scores[1]["total_score"]

    if dimension_count == 1:
        # RIASEC only — cap at Moderate, use gap logic
        if gap >= 15:
            confidence = "Moderate"
        elif gap >= 5:
            confidence = "Low"
        else:
            confidence = "Insufficient"
    else:
        if dimension_agreement == dimension_count and gap >= 10:
            confidence = "High"
        elif dimension_agreement >= dimension_count - 1 and gap >= 5:
            confidence = "Moderate"
        elif gap >= 5:
            confidence = "Low"
        else:
            confidence = "Insufficient"

    # Career readiness caps confidence
    if career_readiness_score is not None and career_readiness_score < 40:
        if confidence == "High":
            confidence = "Moderate"

    if confidence == "Insufficient":
        top_stream_result = None
    else:
        top_stream_result = top_stream

    # Detect cross-dimensional mismatches
    warnings = _detect_mismatches(dim_winners, dimensions, self_efficacy, riasec_scores)

    # Add per-stream flags
    for ss in stream_scores:
        if ss["interest_score"] is not None and ss["academic_score"] is not None:
            if ss["interest_score"] > 70 and ss["academic_score"] < 40:
                ss["flags"].append(f"High interest but weak academic performance for {ss['stream']}")

    # Generate explanation
    explanation = _build_explanation(top_stream_result, confidence, dimension_count, dimension_agreement, gap)

    return {
        "recommended_stream": top_stream_result,
        "confidence": confidence,
        "career_readiness_level": cr_level,
        "all_streams": stream_scores,
        "dimension_count": dimension_count,
        "dimension_agreement": dimension_agreement,
        "explanation": explanation,
        "warnings": warnings,
        "data_completeness": data_completeness,
    }


# ── Internal helpers ───────────────────────────────────────────

def _flat_result(streams: list[str]) -> dict:
    """Result for flat/undifferentiated profiles."""
    return {
        "recommended_stream": None,
        "confidence": "Insufficient",
        "career_readiness_level": "",
        "all_streams": [
            {"stream": s, "total_score": 50.0, "interest_score": 50.0,
             "academic_score": None, "aptitude_score": None,
             "personality_score": None, "feasibility_score": None, "flags": []}
            for s in streams
        ],
        "dimension_count": 0,
        "dimension_agreement": 0,
        "explanation": (
            "Your responses show similar interest levels across all areas. "
            "This usually happens when questions are answered the same way throughout. "
            "For an accurate career profile, please retake the assessment \u2014 "
            "answer each question based on what YOU genuinely enjoy."
        ),
        "warnings": [],
        "data_completeness": {"interest": False, "academic": False, "aptitude": False, "personality": False, "feasibility": False},
    }


def _detect_mismatches(
    dim_winners: dict,
    dimensions: dict,
    self_efficacy: dict | None,
    riasec_scores: dict,
) -> list[str]:
    """Detect cross-dimensional disagreements worth flagging."""
    warnings = []

    # Different dimensions point to different streams
    unique_winners = set(dim_winners.values())
    if len(unique_winners) > 2:
        warnings.append(
            "Your interest, academic, and aptitude profiles point in different directions. "
            "This is not uncommon \u2014 a counsellor can help you find the best path."
        )

    # Interest vs academic mismatch
    if "interest" in dim_winners and "academic" in dim_winners:
        if dim_winners["interest"] != dim_winners["academic"]:
            warnings.append(
                f"Your interests point toward {dim_winners['interest']}, but your academic "
                f"strengths align more with {dim_winners['academic']}. Consider which factor "
                f"matters more to you."
            )

    # Self-efficacy mismatches
    if self_efficacy and riasec_scores:
        riasec_to_domain = {"I": "science", "R": "maths", "A": "arts", "E": "business", "S": "social"}
        for rtype, domain in riasec_to_domain.items():
            interest = riasec_scores.get(rtype, 0)
            # Keys are normalised at ingestion (utils.self_efficacy), so a plain
            # lookup is correct. The old .title() fallback matched only 'Science'.
            confidence = self_efficacy.get(domain, 3)
            if interest > 70 and isinstance(confidence, (int, float)) and confidence <= 2:
                warnings.append(
                    f"You have high {rtype} interest ({interest}%) but low confidence in "
                    f"{domain} ({confidence}/5). Low confidence doesn\u2019t mean low ability \u2014 "
                    f"consider building skills in this area."
                )

    return warnings


def _build_explanation(
    stream: str | None,
    confidence: str,
    dim_count: int,
    dim_agreement: int,
    gap: float,
) -> str:
    """Generate human-readable explanation."""
    if stream is None:
        return (
            "We couldn\u2019t identify a clear stream recommendation from your data. "
            "This may mean your interests are diverse, or more assessment data is needed. "
            "A detailed counsellor session can help narrow this down."
        )

    dim_label = f"{dim_count} dimension{'s' if dim_count > 1 else ''}"
    agree_label = f"{dim_agreement}/{dim_count} dimensions agree" if dim_count > 1 else "based on interests"

    if confidence == "High":
        return (
            f"Based on {dim_label} of analysis ({agree_label}), {stream} is a strong match. "
            f"Your interests, academics, and aptitude clearly align with this direction."
        )
    elif confidence == "Moderate":
        return (
            f"Based on {dim_label} of analysis ({agree_label}), {stream} appears to be a good fit. "
            f"Consider exploring this stream while keeping other options open."
        )
    else:  # Low
        return (
            f"Your profile suggests {stream} may be worth exploring, but the signal is mixed "
            f"({agree_label}). We recommend discussing with a counsellor before deciding."
        )
