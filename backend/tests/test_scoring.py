"""Unit tests for RIASEC scoring engine."""

import pytest
from engines.scoring_engine import (
    calculate_riasec_scores,
    determine_holland_code,
    match_careers,
    load_knowledge_base,
)


class TestCalculateRiasecScores:
    """Test RIASEC score calculation from raw responses."""

    def test_all_neutral_scores_60_percent(self):
        """All 'C' (neutral=3) responses should give 60% per dimension."""
        responses = {f"Q{i}": "C" for i in range(1, 75)}
        result = calculate_riasec_scores(responses)
        scores = result["riasec_scores"]
        for dim in "RIASEC":
            assert scores[dim] == 60.0, f"{dim} should be 60.0 for all neutral"

    def test_all_strongly_agree_gives_100(self):
        """All 'E' (strongly agree=5) should give 100%."""
        responses = {f"Q{i}": "E" for i in range(1, 75)}
        result = calculate_riasec_scores(responses)
        scores = result["riasec_scores"]
        for dim in "RIASEC":
            assert scores[dim] == 100.0

    def test_all_strongly_disagree_gives_20(self):
        """All 'A' (strongly disagree=1) should give 20%."""
        responses = {f"Q{i}": "A" for i in range(1, 75)}
        result = calculate_riasec_scores(responses)
        scores = result["riasec_scores"]
        for dim in "RIASEC":
            assert scores[dim] == 20.0

    def test_high_investigative_pattern(self):
        """High I responses should produce highest I score."""
        responses = {f"Q{i}": "C" for i in range(1, 75)}
        # Q12-Q22 = Investigative, set to E (strongly agree)
        for i in range(12, 23):
            responses[f"Q{i}"] = "E"
        result = calculate_riasec_scores(responses)
        scores = result["riasec_scores"]
        assert scores["I"] == 100.0
        assert scores["R"] == 60.0  # Others stay neutral

    def test_work_values_extracted(self):
        """Work values (Q67-Q74) should be extracted separately."""
        responses = {f"Q{i}": "C" for i in range(1, 75)}
        responses["Q67"] = "E"  # security = 5
        responses["Q68"] = "A"  # independence = 1
        result = calculate_riasec_scores(responses)
        wv = result["work_values"]
        assert wv["security"] == 5
        assert wv["independence"] == 1
        assert len(wv) == 8

    def test_missing_responses_default_to_neutral(self):
        """Missing questions should default to C (neutral=3)."""
        responses = {"Q1": "E", "Q12": "E"}  # Only 2 responses
        result = calculate_riasec_scores(responses)
        scores = result["riasec_scores"]
        # Should not crash, should produce valid scores
        assert all(0 <= scores[d] <= 100 for d in "RIASEC")

    def test_returns_both_scores_and_values(self):
        """Result should contain both riasec_scores and work_values."""
        responses = {f"Q{i}": "C" for i in range(1, 75)}
        result = calculate_riasec_scores(responses)
        assert "riasec_scores" in result
        assert "work_values" in result
        assert len(result["riasec_scores"]) == 6


class TestDetermineHollandCode:
    """Test Holland Code determination from RIASEC scores."""

    def test_clear_top_3(self):
        """Clear top 3 should be selected."""
        scores = {"R": 30, "I": 90, "A": 80, "S": 70, "E": 20, "C": 10}
        assert determine_holland_code(scores) == "IAS"

    def test_tie_broken_by_riasec_order(self):
        """Ties should be broken by RIASEC order (R > I > A > S > E > C)."""
        scores = {"R": 50, "I": 50, "A": 50, "S": 50, "E": 50, "C": 50}
        code = determine_holland_code(scores)
        assert code == "RIA"  # First 3 in RIASEC order

    def test_returns_3_chars(self):
        """Holland code should always be 3 characters."""
        scores = {"R": 10, "I": 20, "A": 30, "S": 40, "E": 50, "C": 60}
        code = determine_holland_code(scores)
        assert len(code) == 3

    def test_single_dominant_type(self):
        """Single very high score should be first in code."""
        scores = {"R": 10, "I": 10, "A": 10, "S": 10, "E": 95, "C": 10}
        code = determine_holland_code(scores)
        assert code[0] == "E"


class TestMatchCareers:
    """Test career matching against knowledge base."""

    @pytest.fixture
    def kb(self):
        return load_knowledge_base()

    def test_returns_list(self, kb):
        matches = match_careers("IRS", kb)
        assert isinstance(matches, list)
        assert len(matches) > 0

    def test_respects_top_n(self, kb):
        matches = match_careers("IRS", kb, top_n=5)
        assert len(matches) <= 5

    def test_match_has_required_fields(self, kb):
        matches = match_careers("IRS", kb, top_n=1)
        m = matches[0]
        assert "career_id" in m
        assert "career_name" in m
        assert "match_score" in m
        assert "match_type" in m

    def test_scores_normalized_0_100(self, kb):
        matches = match_careers("IRS", kb)
        for m in matches:
            assert 0 <= m["match_score"] <= 100

    def test_primary_match_type(self, kb):
        """Careers with matching primary type should be labeled 'primary'."""
        matches = match_careers("IRS", kb)
        primary_matches = [m for m in matches if m["match_type"] == "primary"]
        assert len(primary_matches) > 0

    def test_different_codes_get_different_results(self, kb):
        matches_irs = match_careers("IRS", kb, top_n=5)
        matches_ase = match_careers("ASE", kb, top_n=5)
        ids_irs = {m["career_id"] for m in matches_irs}
        ids_ase = {m["career_id"] for m in matches_ase}
        # Should not be identical
        assert ids_irs != ids_ase

    def test_empty_code_returns_empty(self, kb):
        matches = match_careers("", kb)
        assert matches == []


class TestLoadKnowledgeBase:
    """Test knowledge base loading."""

    def test_loads_careers(self):
        """KB should have at least 100 careers (expanded to 143+)."""
        kb = load_knowledge_base()
        assert len(kb) >= 100

    def test_careers_have_required_fields(self):
        kb = load_knowledge_base()
        for career in kb:
            assert "career_id" in career
            assert "career_name" in career
            assert "riasec_code" in career
            assert "riasec_primary" in career

    def test_riasec_codes_are_valid(self):
        kb = load_knowledge_base()
        valid_types = set("RIASEC")
        for career in kb:
            for c in career["riasec_code"]:
                assert c in valid_types, f"Invalid RIASEC type '{c}' in {career['career_id']}"