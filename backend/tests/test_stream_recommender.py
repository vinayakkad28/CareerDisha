"""Tests for multi-dimensional stream recommendation engine."""

import pytest
from engines.stream_recommender import recommend_stream, riasec_to_stream_interest
from engines.academic_scorer import calculate_academic_fit, detect_academic_mismatches
from engines.family_scorer import calculate_family_feasibility
from engines.aptitude_scorer import score_aptitude, calculate_aptitude_stream_fit


class TestRiasecToStreamInterest:
    def test_basic_conversion(self):
        scores = {"R": 80, "I": 90, "A": 30, "S": 40, "E": 50, "C": 60}
        result = riasec_to_stream_interest(scores)
        assert result["Science (PCM)"] == 85.0  # (R+I)/2
        assert result["Science (PCB)"] == 65.0  # (I+S)/2
        assert result["Commerce"] == 55.0       # (E+C)/2
        assert result["Arts/Humanities"] == 35.0 # (A+S)/2

    def test_flat_scores(self):
        scores = {"R": 60, "I": 60, "A": 60, "S": 60, "E": 60, "C": 60}
        result = riasec_to_stream_interest(scores)
        assert all(v == 60.0 for v in result.values())


class TestRecommendStreamRIASECOnly:
    def test_clear_pcm_profile(self):
        scores = {"R": 90, "I": 85, "A": 30, "S": 35, "E": 25, "C": 20}
        rec = recommend_stream(scores)
        assert rec["recommended_stream"] is not None
        assert "Science (PCM)" in rec["recommended_stream"] or rec["all_streams"][0]["stream"] == "Science (PCM)"
        assert rec["dimension_count"] == 1

    def test_flat_profile_returns_insufficient(self):
        scores = {"R": 60, "I": 60, "A": 60, "S": 60, "E": 60, "C": 60}
        rec = recommend_stream(scores)
        assert rec["recommended_stream"] is None
        assert rec["confidence"] == "Insufficient"

    def test_riasec_only_capped_at_moderate(self):
        scores = {"R": 95, "I": 90, "A": 20, "S": 15, "E": 10, "C": 10}
        rec = recommend_stream(scores)
        assert rec["confidence"] in ("Moderate", "Low")
        assert rec["dimension_count"] == 1

    def test_data_completeness_riasec_only(self):
        scores = {"R": 80, "I": 70, "A": 50, "S": 40, "E": 30, "C": 20}
        rec = recommend_stream(scores)
        assert rec["data_completeness"]["interest"] is True
        assert rec["data_completeness"]["academic"] is False
        assert rec["data_completeness"]["aptitude"] is False
        assert rec["data_completeness"]["feasibility"] is False


class TestRecommendStreamMultiDimensional:
    def test_two_dimensions(self):
        scores = {"R": 80, "I": 85, "A": 30, "S": 35, "E": 25, "C": 20}
        academic = {"Science (PCM)": 90, "Science (PCB)": 60, "Commerce": 50, "Arts/Humanities": 40}
        rec = recommend_stream(scores, academic_fit=academic)
        assert rec["dimension_count"] == 2
        assert rec["data_completeness"]["academic"] is True

    def test_all_four_dimensions(self):
        scores = {"R": 80, "I": 85, "A": 30, "S": 35, "E": 25, "C": 20}
        academic = {"Science (PCM)": 90, "Science (PCB)": 60, "Commerce": 50, "Arts/Humanities": 40}
        aptitude = {"Science (PCM)": 85, "Science (PCB)": 55, "Commerce": 45, "Arts/Humanities": 35}
        feasibility = {"Science (PCM)": 70, "Science (PCB)": 70, "Commerce": 80, "Arts/Humanities": 80}
        rec = recommend_stream(scores, academic, aptitude, feasibility)
        assert rec["dimension_count"] == 4
        assert rec["recommended_stream"] == "Science (PCM)"
        assert rec["confidence"] == "High"

    def test_disagreement_lowers_confidence(self):
        scores = {"R": 20, "I": 25, "A": 80, "S": 75, "E": 30, "C": 20}  # Arts interest
        academic = {"Science (PCM)": 90, "Science (PCB)": 60, "Commerce": 50, "Arts/Humanities": 40}  # PCM academics
        rec = recommend_stream(scores, academic_fit=academic)
        assert len(rec["warnings"]) > 0  # Should warn about mismatch


class TestAcademicScorer:
    def test_returns_none_for_no_data(self):
        assert calculate_academic_fit(None) is None
        assert calculate_academic_fit({}) is None

    def test_basic_scoring(self):
        marks = {"maths": 90, "science": 80, "english": 70}
        result = calculate_academic_fit(marks)
        assert result is not None
        assert result["Science (PCM)"] > result["Arts/Humanities"]

    def test_grade_conversion(self):
        marks = {"maths": "A", "science": "B", "english": "C"}
        result = calculate_academic_fit(marks)
        assert result is not None
        assert result["Science (PCM)"] > 70

    def test_mismatch_detection(self):
        warnings = detect_academic_mismatches("Science (PCM)", {"maths": 30, "science": 80})
        assert len(warnings) > 0
        assert "Maths" in warnings[0]

    def test_no_mismatch_when_good(self):
        warnings = detect_academic_mismatches("Science (PCM)", {"maths": 85, "science": 80})
        assert len(warnings) == 0


class TestFamilyScorer:
    def test_returns_none_for_no_data(self):
        assert calculate_family_feasibility(None) is None
        assert calculate_family_feasibility({}) is None

    def test_basic_scoring(self):
        context = {"coaching_affordability": "yes_easily", "family_income": "above_25l"}
        result = calculate_family_feasibility(context)
        assert result is not None
        assert all(v >= 10 for v in result.values())

    def test_no_coaching_reduces_pcm(self):
        easy = calculate_family_feasibility({"coaching_affordability": "yes_easily"})
        hard = calculate_family_feasibility({"coaching_affordability": "no"})
        assert hard["Science (PCM)"] < easy["Science (PCM)"]

    def test_scores_never_zero(self):
        worst = {"coaching_affordability": "no", "mobility_willingness": "no",
                 "family_income": "below_3l", "location_type": "rural"}
        result = calculate_family_feasibility(worst)
        assert all(v >= 10 for v in result.values())


class TestAptitudeScorer:
    def test_returns_none_for_no_data(self):
        assert score_aptitude(None) is None
        assert score_aptitude({}) is None

    def test_perfect_score(self):
        # All correct answers
        responses = {
            "APT_N1": "B", "APT_N2": "C", "APT_N3": "B", "APT_N4": "C", "APT_N5": "B",
            "APT_V1": "B", "APT_V2": "C", "APT_V3": "C", "APT_V4": "B", "APT_V5": "B",
            "APT_S1": "A", "APT_S2": "B", "APT_S3": "D", "APT_S4": "B", "APT_S5": "A",
        }
        result = score_aptitude(responses)
        assert result is not None
        assert result["numerical"] == 100.0
        assert result["verbal"] == 100.0
        assert result["spatial"] == 100.0

    def test_zero_score(self):
        # All wrong answers
        responses = {
            "APT_N1": "D", "APT_N2": "D", "APT_N3": "D", "APT_N4": "D", "APT_N5": "D",
            "APT_V1": "D", "APT_V2": "D", "APT_V3": "D", "APT_V4": "D", "APT_V5": "D",
            "APT_S1": "D", "APT_S2": "D", "APT_S3": "A", "APT_S4": "D", "APT_S5": "D",
        }
        result = score_aptitude(responses)
        assert result is not None
        assert result["total"] < 20

    def test_stream_fit(self):
        scores = {"numerical": 90, "verbal": 50, "spatial": 70, "total": 70}
        result = calculate_aptitude_stream_fit(scores)
        assert result is not None
        assert result["Science (PCM)"] > result["Arts/Humanities"]
