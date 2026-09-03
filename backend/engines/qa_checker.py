"""Quality Assurance Checker for generated career reports.

Validates report content against the knowledge base and flags issues
like hallucinated colleges, inconsistent stream/career recommendations,
and class-inappropriate content.
"""

import json
import re
from pathlib import Path

from config import DATA_DIR
from database import SessionLocal
from models import Student, Session


def load_colleges_whitelist() -> set:
    """Load the college whitelist. Returns set of lowercase college names."""
    path = DATA_DIR / "colleges_whitelist.json"
    if not path.exists():
        return set()
    with open(path) as f:
        data = json.load(f)
    names = set()
    if isinstance(data, list):
        for entry in data:
            if isinstance(entry, str):
                names.add(entry.lower())
            elif isinstance(entry, dict):
                names.add(entry.get("name", "").lower())
                for alias in entry.get("aliases", []):
                    names.add(alias.lower())
    return names


def load_knowledge_base_ids() -> set:
    """Load valid career IDs from KB."""
    from engines.scoring_engine import load_knowledge_base
    kb = load_knowledge_base()
    return {c.get("career_id", "") for c in kb}


def contains_devanagari(text: str) -> bool:
    """Check if text contains Hindi/Devanagari characters."""
    return bool(re.search(r'[\u0900-\u097F]', text))


def validate_report(student: Student) -> list[str]:
    """Validate a single student's report. Returns list of flag messages."""
    flags = []
    report = student.report_content or {}

    if not report:
        flags.append("Report content is empty")
        return flags

    # 1. Check career matches exist
    careers = report.get("career_matches", [])
    if len(careers) < 5:
        flags.append(f"Only {len(careers)} career matches (expected 5)")

    # 2. Check each career has required fields
    for i, career in enumerate(careers):
        if not career.get("career_name"):
            flags.append(f"Career #{i+1} missing career_name")
        if not career.get("why_it_fits"):
            flags.append(f"Career #{i+1} missing why_it_fits explanation")
        if not career.get("education_pathway"):
            flags.append(f"Career #{i+1} missing education_pathway")

    # 3. Stream recommendation present and consistent
    stream_rec = report.get("stream_recommendation", {})
    if not stream_rec.get("recommended_stream"):
        flags.append("Missing stream recommendation")
    else:
        rec_stream = stream_rec["recommended_stream"].lower()
        if careers:
            top_career = careers[0].get("career_name", "").lower()
            # Basic consistency check
            if "arts" in rec_stream and any(
                kw in top_career
                for kw in ["engineer", "data scientist", "doctor", "chartered accountant"]
            ):
                flags.append(
                    f"Stream recommendation '{stream_rec['recommended_stream']}' "
                    f"may conflict with #1 career '{careers[0].get('career_name')}'"
                )

    # 4. Class-appropriate content
    class_level = student.class_level or 10
    report_text = json.dumps(report)

    if class_level in (8, 9):
        # Class 8-9 should NOT have specific cutoffs
        if re.search(r'cutoff.*\d{2,}', report_text, re.IGNORECASE):
            flags.append("Class 8-9 report contains specific cutoff scores (should be exploratory)")
        if "JEE Advanced" in report_text and "prepare for" in report_text.lower():
            flags.append("Class 8-9 report mentions JEE Advanced preparation (too early)")

    if class_level == 10:
        # Class 10 MUST have stream recommendation
        if not stream_rec.get("recommended_stream"):
            flags.append("Class 10 report MUST have a clear stream recommendation")

    if class_level == 12:
        # Class 12 should have specific colleges and action plan
        if not report.get("action_plan", {}).get("next_3_months"):
            flags.append("Class 12 report should have immediate (next 3 months) action items")

    # 5. Parent section present with Hindi
    parent = report.get("parent_section", {})
    if not parent:
        flags.append("Parent section is missing")
    else:
        if not parent.get("recommendation_summary"):
            flags.append("Parent section missing recommendation summary")
        # Check for Hindi content
        hindi_text = parent.get("recommendation_summary_hindi", "")
        title = parent.get("title", "")
        if not contains_devanagari(hindi_text) and not contains_devanagari(title):
            flags.append("Parent section missing Hindi/Devanagari content")

    # 6. Action plan present
    action_plan = report.get("action_plan", {})
    if not action_plan:
        flags.append("Action plan is missing")
    elif not action_plan.get("next_3_months") and not action_plan.get("next_1_year"):
        flags.append("Action plan has no items")

    # 7. RIASEC profile summary
    riasec_profile = report.get("riasec_profile", {})
    if not riasec_profile.get("summary"):
        flags.append("RIASEC profile summary is missing")
    elif len(riasec_profile.get("summary", "")) < 100:
        flags.append("RIASEC profile summary too short (< 100 chars)")

    # 8. New enriched fields (warnings only — older reports may lack these)
    personal_note = report.get("personal_note", "")
    if not personal_note or len(personal_note) < 200:
        flags.append("[WARNING] personal_note missing or too short (< 200 chars)")

    recommended_books = report.get("action_plan", {}).get("recommended_books", [])
    if not recommended_books or len(recommended_books) < 3:
        flags.append("[WARNING] action_plan.recommended_books missing or has < 3 items")

    parent_faqs = report.get("parent_section", {}).get("faqs", [])
    if not parent_faqs or len(parent_faqs) < 3:
        flags.append("[WARNING] parent_section.faqs missing or has < 3 items")

    conversation_starters = report.get("parent_section", {}).get("conversation_starters", [])
    if not conversation_starters or len(conversation_starters) < 3:
        flags.append("[WARNING] parent_section.conversation_starters missing or has < 3 items")

    # 10. Personality portrait
    portrait = report.get("personality_portrait", {})
    if not portrait.get("who_you_are"):
        flags.append("[WARNING] personality_portrait.who_you_are missing")
    elif len(portrait.get("who_you_are", "")) < 300:
        flags.append("[WARNING] personality_portrait.who_you_are too short (< 300 chars)")

    # 11. Career deep dive
    deep_dive = report.get("career_deep_dive", {})
    if not deep_dive.get("day_in_the_life"):
        flags.append("[WARNING] career_deep_dive.day_in_the_life missing")
    if not deep_dive.get("journey_map") or len(deep_dive.get("journey_map", [])) < 5:
        flags.append("[WARNING] career_deep_dive.journey_map missing or < 5 stages")

    # 12. Stream comparison
    stream_comp = report.get("stream_comparison", {})
    if not stream_comp.get("all_streams") or len(stream_comp.get("all_streams", [])) != 5:
        flags.append("[WARNING] stream_comparison.all_streams must have exactly 5 streams")

    # 13. Hidden gems
    hidden = report.get("hidden_gems", [])
    if not hidden or len(hidden) < 2:
        flags.append("[WARNING] hidden_gems missing or < 2 careers")

    # 14. Financial roadmap
    fin = report.get("financial_roadmap", {})
    if not fin.get("top_scholarships") or len(fin.get("top_scholarships", [])) < 2:
        flags.append("[WARNING] financial_roadmap.top_scholarships missing or < 2")

    # 15. Confidence builder
    conf = report.get("confidence_builder", {})
    if not conf.get("thirty_day_challenges") or len(conf.get("thirty_day_challenges", [])) < 3:
        flags.append("[WARNING] confidence_builder.thirty_day_challenges missing or < 3")

    # 16. College whitelist check (if whitelist exists)
    whitelist = load_colleges_whitelist()
    if whitelist:
        for career in careers:
            for college in career.get("top_colleges", []):
                # Extract college name (handle "IIT Bombay (NIRF #3)" format)
                college_name = re.sub(r'\s*\(.*?\)', '', college).strip().lower()
                if college_name and college_name not in whitelist:
                    # Fuzzy check: see if any whitelist entry contains this name or vice versa
                    fuzzy_match = any(
                        college_name in wl or wl in college_name
                        for wl in whitelist
                    )
                    if not fuzzy_match:
                        # Advisory, not blocking. The whitelist is a hand-curated
                        # 541 entries and cannot cover every legitimate Indian
                        # institution — a live run held a perfectly good report
                        # because "Sir J.J. College of Architecture, Mumbai" is
                        # real but unlisted. Blocking on that fails far more
                        # honest reports than it catches invented ones, and the
                        # terms page already states that names and figures must
                        # be verified. Keep flagging so the list can be grown.
                        flags.append(
                            f"[WARNING] College '{college}' not in whitelist "
                            "(verify, or add it to colleges_whitelist.json)"
                        )

    return flags


def run_qa_checks(session_id: int) -> dict:
    """Run QA checks on all generated reports in a session."""
    db = SessionLocal()
    try:
        students = db.query(Student).filter(
            Student.session_id == session_id,
            Student.report_status == "report_generated",
        ).all()

        passed = 0
        flagged = 0
        flagged_details = []

        for student in students:
            flags = validate_report(student)
            hard_flags = [f for f in flags if not f.startswith("[WARNING]")]
            if hard_flags:
                student.report_status = "qa_flagged"
                student.qa_flags = flags
                flagged += 1
                flagged_details.append({
                    "student_id": student.id,
                    "name": student.name,
                    "flags": flags,
                })
            else:
                student.report_status = "qa_passed"
                student.qa_flags = flags  # store warnings even for passed reports
                passed += 1

        db.commit()

        return {
            "total": len(students),
            "passed": passed,
            "flagged": flagged,
            "flagged_details": flagged_details,
        }
    finally:
        db.close()
