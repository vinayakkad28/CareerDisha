"""Unit tests for report generator — prompt building and LLM client setup.

These tests validate prompt construction and structure without making actual API calls.
"""

import json
import pytest
from unittest.mock import patch, MagicMock

from engines.report_generator import (
    LLMClient,
    SYSTEM_PROMPT,
    build_user_prompt,
)
from engines.scoring_engine import load_knowledge_base


class FakeStudent:
    """Minimal stand-in for a Student ORM object."""

    def __init__(self, **kwargs):
        self.name = kwargs.get("name", "Test Student")
        self.class_level = kwargs.get("class_level", 10)
        self.riasec_scores = kwargs.get("riasec_scores", {"R": 50, "I": 80, "A": 40, "S": 60, "E": 30, "C": 35})
        self.holland_code = kwargs.get("holland_code", "ISR")
        self.work_values = kwargs.get("work_values", {
            "security": 3, "independence": 4, "continuous_learning": 5,
            "social_impact": 3, "high_income": 3, "creativity": 2,
            "adventure": 2, "structured_environment": 3,
        })
        self.matched_careers = kwargs.get("matched_careers", [])
        self.stream_pref_parent = kwargs.get("stream_pref_parent", "")
        self.stream_pref_student = kwargs.get("stream_pref_student", "")
        self.career_concern = kwargs.get("career_concern", "")


class TestSystemPrompt:
    """Verify critical rules are in the system prompt."""

    def test_india_specific(self):
        assert "India" in SYSTEM_PROMPT

    def test_no_western_exams(self):
        assert "NEVER mention SAT" in SYSTEM_PROMPT

    def test_nirf_reference(self):
        assert "NIRF" in SYSTEM_PROMPT

    def test_lpa_salary(self):
        assert "LPA" in SYSTEM_PROMPT

    def test_hindi_requirement(self):
        assert "Hindi" in SYSTEM_PROMPT or "Devanagari" in SYSTEM_PROMPT

    def test_encouraging_tone(self):
        assert "encouraging" in SYSTEM_PROMPT.lower()

    def test_ethical_guidelines(self):
        assert "interest inventory" in SYSTEM_PROMPT.lower() or "INTEREST INVENTORY" in SYSTEM_PROMPT

    def test_json_output_requirement(self):
        assert "JSON" in SYSTEM_PROMPT


class TestBuildUserPrompt:
    """Test user prompt construction."""

    @pytest.fixture
    def kb(self):
        return load_knowledge_base()

    def test_prompt_contains_student_name(self, kb):
        student = FakeStudent(name="Aarav Sharma")
        prompt = build_user_prompt(student, kb[:5])
        assert "Aarav Sharma" in prompt

    def test_prompt_contains_class(self, kb):
        student = FakeStudent(class_level=12)
        prompt = build_user_prompt(student, kb[:5])
        assert "Class: 12" in prompt

    def test_prompt_contains_riasec_scores(self, kb):
        student = FakeStudent(riasec_scores={"R": 72, "I": 85, "A": 45, "S": 60, "E": 38, "C": 30})
        prompt = build_user_prompt(student, kb[:5])
        assert "R=72%" in prompt
        assert "I=85%" in prompt

    def test_prompt_contains_holland_code(self, kb):
        student = FakeStudent(holland_code="IRS")
        prompt = build_user_prompt(student, kb[:5])
        assert "IRS" in prompt

    def test_prompt_contains_career_details(self, kb):
        student = FakeStudent()
        prompt = build_user_prompt(student, kb[:5])
        # Should contain career data from KB
        assert "career_id" in prompt or "career_name" in prompt

    def test_prompt_contains_class_instructions(self, kb):
        student = FakeStudent(class_level=8)
        prompt = build_user_prompt(student, kb[:5])
        assert "EXPLORATION" in prompt or "explore" in prompt.lower()

    def test_class_10_prompt_mentions_stream(self, kb):
        student = FakeStudent(class_level=10)
        prompt = build_user_prompt(student, kb[:5])
        assert "STREAM" in prompt or "stream" in prompt

    def test_class_12_prompt_mentions_action(self, kb):
        student = FakeStudent(class_level=12)
        prompt = build_user_prompt(student, kb[:5])
        assert "ACTION" in prompt or "action" in prompt.lower()

    def test_stream_pref_gap_included(self, kb):
        student = FakeStudent(
            class_level=10,
            stream_pref_parent="Science PCM",
            stream_pref_student="Arts/Humanities",
        )
        prompt = build_user_prompt(student, kb[:5])
        assert "GAP" in prompt

    def test_career_concern_included(self, kb):
        student = FakeStudent(
            class_level=10,
            career_concern="parent_pressure",
        )
        prompt = build_user_prompt(student, kb[:5])
        assert "parent_pressure" in prompt

    def test_prompt_requests_5_careers(self, kb):
        student = FakeStudent()
        prompt = build_user_prompt(student, kb[:5])
        assert "5 careers" in prompt or "exactly 5" in prompt.lower()

    def test_prompt_requests_json_output(self, kb):
        student = FakeStudent()
        prompt = build_user_prompt(student, kb[:5])
        assert "JSON" in prompt


class TestLLMClient:
    """Test LLM client initialization and provider routing."""

    def test_anthropic_provider(self):
        client = LLMClient("anthropic")
        assert client.provider == "anthropic"

    def test_openai_provider(self):
        client = LLMClient("openai")
        assert client.provider == "openai"

    def test_google_provider(self):
        client = LLMClient("google")
        assert client.provider == "google"

    def test_unknown_provider_raises(self):
        client = LLMClient("unknown")
        with pytest.raises(ValueError, match="Unknown provider"):
            client.generate("system", "user")


class TestClassInstructions:
    """Verify class-specific instructions are properly differentiated."""

    def test_all_classes_have_instructions(self):
        from config import CLASS_INSTRUCTIONS
        for cls in (8, 9, 10, 11, 12):
            assert cls in CLASS_INSTRUCTIONS
            assert len(CLASS_INSTRUCTIONS[cls]) > 50

    def test_class_8_is_exploratory(self):
        from config import CLASS_INSTRUCTIONS
        instr = CLASS_INSTRUCTIONS[8]
        assert "EXPLORATION" in instr or "explore" in instr.lower()
        assert "DO NOT" in instr

    def test_class_10_has_stream_recommendation(self):
        from config import CLASS_INSTRUCTIONS
        instr = CLASS_INSTRUCTIONS[10]
        assert "STREAM RECOMMENDATION" in instr or "stream" in instr.lower()

    def test_class_12_is_actionable(self):
        from config import CLASS_INSTRUCTIONS
        instr = CLASS_INSTRUCTIONS[12]
        assert "ACTION" in instr
        assert "deadline" in instr.lower() or "dates" in instr.lower() or "calendar" in instr.lower()


class TestPermanentErrorHandling:
    """A permanent provider error must not be retried.

    This regressed silently once: the check was implemented as a virtual base
    class with a custom __instancecheck__, used in an `except` clause. CPython
    matches exceptions with PyErr_GivenExceptionMatches, which does not consult
    __instancecheck__, so isinstance() said True while the except clause fell
    through to the retry branch. A 404 for a retired model burned nine attempts.
    """

    def test_retired_model_is_permanent(self):
        from engines.report_generator import _is_permanent_llm_error

        class NotFoundError(Exception):
            pass

        assert _is_permanent_llm_error(NotFoundError("model does not exist"))

    def test_http_4xx_status_is_permanent(self):
        from engines.report_generator import _is_permanent_llm_error

        class ProviderError(Exception):
            status_code = 404

        assert _is_permanent_llm_error(ProviderError())

    def test_transient_errors_are_retried(self):
        from engines.report_generator import _is_permanent_llm_error

        class RateLimitError(Exception):
            pass

        class APIConnectionError(Exception):
            pass

        assert not _is_permanent_llm_error(RateLimitError("slow down"))
        assert not _is_permanent_llm_error(APIConnectionError("network"))

    def test_permanent_error_raises_without_retrying(self, monkeypatch):
        """The retry loop must surface a permanent error on the first attempt."""
        from engines.report_generator import LLMClient

        class NotFoundError(Exception):
            pass

        attempts = {"n": 0}

        def boom(self, system_prompt, user_prompt):
            attempts["n"] += 1
            raise NotFoundError("The model does not exist or you do not have access to it")

        monkeypatch.setattr(LLMClient, "_call_groq", boom)
        client = LLMClient(provider="groq")
        try:
            client.generate("sys", "user")
        except NotFoundError:
            pass
        assert attempts["n"] == 1, f"retried a permanent error {attempts['n']} times"
