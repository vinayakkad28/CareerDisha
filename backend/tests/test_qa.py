"""Unit tests for QA checker."""

import pytest
from engines.qa_checker import validate_report, contains_devanagari, load_colleges_whitelist


class FakeStudent:
    """Minimal stand-in for a Student ORM object, used by validate_report."""

    def __init__(self, class_level=10, report_content=None):
        self.class_level = class_level
        self.report_content = report_content or {}


def _make_valid_report():
    """Return a minimal report dict that passes all QA checks."""
    return {
        "riasec_profile": {
            "summary": "A" * 120,  # > 100 chars
            "primary_type_description": "Desc1",
            "secondary_type_description": "Desc2",
            "tertiary_type_description": "Desc3",
        },
        "stream_recommendation": {
            "recommended_stream": "Science (PCM)",
            "confidence": "High",
            "reasoning": "Strong I and R scores",
            "subject_combination": "Physics, Chemistry, Maths, CS, English",
            "alternative_stream": "Commerce with Maths",
        },
        "career_matches": [
            {
                "rank": i + 1,
                "career_name": f"Career {i + 1}",
                "career_name_hindi": "करियर",
                "match_score": 90 - i * 5,
                "why_it_fits": "Fits because of strong analytical skills.",
                "education_pathway": "B.Tech → M.Tech",
                "entrance_exams": ["JEE Main"],
                "top_colleges": ["IIT Bombay (NIRF #3)"],
                "salary_range": "6-12 LPA entry",
                "growth_outlook": "High",
            }
            for i in range(5)
        ],
        "action_plan": {
            "next_3_months": ["Action 1"],
            "next_1_year": ["Action 2"],
            "next_2_3_years": ["Action 3"],
            "recommended_books": ["Book 1", "Book 2", "Book 3"],
        },
        "parent_section": {
            "title": "अभिभावकों के लिए / For Parents",
            "recommendation_summary": "Your child shows strong analytical interests.",
            "recommendation_summary_hindi": "आपके बच्चे में विश्लेषणात्मक रुचि है।",
            "what_to_do_now": ["Encourage STEM"],
            "common_concerns_addressed": "Good salary and job security.",
            "how_to_support": "Provide resources.",
            "faqs": [
                {"question_en": "Q1", "question_hi": "प्र1", "answer_en": "A1", "answer_hi": "उ1"},
                {"question_en": "Q2", "question_hi": "प्र2", "answer_en": "A2", "answer_hi": "उ2"},
                {"question_en": "Q3", "question_hi": "प्र3", "answer_en": "A3", "answer_hi": "उ3"},
            ],
            "conversation_starters": ["Starter 1", "Starter 2", "Starter 3"],
        },
        "personal_note": "A" * 210,
    }


class TestContainsDevanagari:
    def test_hindi_text(self):
        assert contains_devanagari("अभिभावक") is True

    def test_english_text(self):
        assert contains_devanagari("For Parents") is False

    def test_mixed_text(self):
        assert contains_devanagari("अभिभावकों / For Parents") is True

    def test_empty_text(self):
        assert contains_devanagari("") is False


class TestValidateReport:
    def test_valid_report_passes(self):
        student = FakeStudent(class_level=10, report_content=_make_valid_report())
        flags = validate_report(student)
        assert flags == []

    def test_empty_report_flagged(self):
        student = FakeStudent(class_level=10, report_content={})
        flags = validate_report(student)
        assert any("empty" in f.lower() for f in flags)

    def test_missing_careers_flagged(self):
        report = _make_valid_report()
        report["career_matches"] = report["career_matches"][:2]
        student = FakeStudent(class_level=10, report_content=report)
        flags = validate_report(student)
        assert any("career" in f.lower() and "2" in f for f in flags)

    def test_missing_stream_recommendation_flagged(self):
        report = _make_valid_report()
        report["stream_recommendation"] = {}
        student = FakeStudent(class_level=10, report_content=report)
        flags = validate_report(student)
        assert any("stream" in f.lower() for f in flags)

    def test_missing_parent_section_flagged(self):
        report = _make_valid_report()
        report["parent_section"] = {}
        student = FakeStudent(class_level=10, report_content=report)
        flags = validate_report(student)
        assert any("parent" in f.lower() for f in flags)

    def test_missing_hindi_in_parent_section_flagged(self):
        report = _make_valid_report()
        report["parent_section"]["recommendation_summary_hindi"] = "English only"
        report["parent_section"]["title"] = "For Parents"
        student = FakeStudent(class_level=10, report_content=report)
        flags = validate_report(student)
        assert any("hindi" in f.lower() or "devanagari" in f.lower() for f in flags)

    def test_short_riasec_summary_flagged(self):
        report = _make_valid_report()
        report["riasec_profile"]["summary"] = "Too short"
        student = FakeStudent(class_level=10, report_content=report)
        flags = validate_report(student)
        assert any("summary" in f.lower() and "short" in f.lower() for f in flags)

    def test_missing_action_plan_flagged(self):
        report = _make_valid_report()
        report["action_plan"] = {}
        student = FakeStudent(class_level=10, report_content=report)
        flags = validate_report(student)
        assert any("action plan" in f.lower() for f in flags)

    def test_class_10_requires_stream_recommendation(self):
        report = _make_valid_report()
        report["stream_recommendation"]["recommended_stream"] = ""
        student = FakeStudent(class_level=10, report_content=report)
        flags = validate_report(student)
        assert any("class 10" in f.lower() and "stream" in f.lower() for f in flags)

    def test_class_12_requires_immediate_actions(self):
        report = _make_valid_report()
        report["action_plan"]["next_3_months"] = []
        student = FakeStudent(class_level=12, report_content=report)
        flags = validate_report(student)
        assert any("class 12" in f.lower() for f in flags)

    def test_arts_stream_with_engineering_career_flagged(self):
        report = _make_valid_report()
        report["stream_recommendation"]["recommended_stream"] = "Arts / Humanities"
        report["career_matches"][0]["career_name"] = "Software Engineer"
        student = FakeStudent(class_level=10, report_content=report)
        flags = validate_report(student)
        assert any("conflict" in f.lower() for f in flags)

    def test_career_missing_why_it_fits_flagged(self):
        report = _make_valid_report()
        report["career_matches"][0]["why_it_fits"] = ""
        student = FakeStudent(class_level=10, report_content=report)
        flags = validate_report(student)
        assert any("why_it_fits" in f for f in flags)


class TestLoadCollegesWhitelist:
    def test_loads_nonempty_set(self):
        whitelist = load_colleges_whitelist()
        assert len(whitelist) > 50

    def test_contains_known_colleges(self):
        whitelist = load_colleges_whitelist()
        assert "iit bombay" in whitelist
        assert "aiims delhi" in whitelist

    def test_aliases_included(self):
        whitelist = load_colleges_whitelist()
        assert "iitb" in whitelist or "indian institute of technology bombay" in whitelist
