#!/usr/bin/env python3
"""CareerNeeti CLI — Batch processing tool for career assessment reports.

Usage:
    python careerneeti.py score   --zipgrade-csv ... --student-info ... --output scored.json
    python careerneeti.py generate --profiles scored.json --model gemini --output reports.json
    python careerneeti.py pdf     --reports reports.json --output-dir ./output/
    python careerneeti.py send    --reports-dir ./output/ --student-info students.csv
    python careerneeti.py pipeline --zipgrade-csv ... --student-info ... --model gemini --output-dir ./output/
"""

import csv
import json
import re
import time
from pathlib import Path

import click
from dotenv import load_dotenv

load_dotenv()

from config import (
    DATA_DIR,
    LIKERT_MAP,
    RIASEC_TYPES,
    RIASEC_TYPE_NAMES,
    MAX_CONCURRENT_REQUESTS,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _contains_devanagari(text: str) -> bool:
    """Check if text contains Hindi/Devanagari characters."""
    return bool(re.search(r'[\u0900-\u097F]', text))


def _load_knowledge_base(kb_path: str | None = None) -> list:
    """Load career knowledge base from JSON file."""
    path = Path(kb_path) if kb_path else DATA_DIR / "career_knowledge_base.json"
    with open(path) as f:
        data = json.load(f)
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and "careers" in data:
        return data["careers"]
    if isinstance(data, dict) and "categories" in data:
        careers = []
        for cat in data["categories"]:
            careers.extend(cat.get("careers", []))
        return careers
    return data


def _parse_zipgrade_csv(path: str) -> dict[str, dict]:
    """Parse ZipGrade CSV export. Returns {student_id: {Q1: 'A', Q2: 'D', ...}}."""
    records = {}
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sid = (
                row.get("StudentID", "")
                or row.get("Student ID", "")
                or row.get("student_id", "")
            ).strip()
            if not sid:
                continue
            responses = {}
            for i in range(1, 75):
                key = f"Q{i}"
                val = row.get(key, row.get(f"q{i}", "")).strip().upper()
                if val in ("A", "B", "C", "D", "E"):
                    responses[key] = val
            if responses:
                records[sid] = responses
    return records


def _parse_student_info_csv(path: str) -> dict[str, dict]:
    """Parse student info CSV. Returns {student_id: {name, class, ...}}."""
    records = {}
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sid = row.get("student_id", "").strip()
            if not sid:
                continue
            try:
                class_val = row.get("class", row.get("class_level", "10")).strip()
                class_level = int(class_val) if class_val else 10
                if class_level not in (8, 9, 10, 11, 12):
                    class_level = 10
            except (ValueError, TypeError):
                class_level = 10
            records[sid] = {
                "name": row.get("name", "").strip(),
                "class": class_level,
                "section": row.get("section", "").strip(),
                "school": row.get("school", "").strip(),
                "city": row.get("city", "").strip(),
                "parent_phone": row.get("parent_phone", "").strip(),
                "parent_name": row.get("parent_name", "").strip(),
                "stream_pref_parent": row.get("stream_pref_parent", "").strip(),
                "stream_pref_student": row.get("stream_pref_student", "").strip(),
                "career_concern": row.get("career_concern", "").strip(),
            }
    return records


def _calculate_riasec(raw_responses: dict) -> dict:
    """Calculate RIASEC scores from raw Q1-Q74 responses."""
    from engines.scoring_engine import load_riasec_item_map

    item_map = load_riasec_item_map()
    dimension_scores: dict[str, list[int]] = {t: [] for t in RIASEC_TYPES}
    work_value_scores: list[int] = []

    for q_key, dimension in item_map.items():
        response = raw_responses.get(q_key, "C")
        score = LIKERT_MAP.get(response.upper(), 3)
        if dimension == "WV":
            work_value_scores.append(score)
        elif dimension in dimension_scores:
            dimension_scores[dimension].append(score)

    riasec_scores = {}
    for dim_type in RIASEC_TYPES:
        scores = dimension_scores[dim_type]
        if scores:
            raw_sum = sum(scores)
            max_possible = len(scores) * 5
            riasec_scores[dim_type] = round((raw_sum / max_possible) * 100, 1)
        else:
            riasec_scores[dim_type] = 0.0

    work_value_labels = [
        "security", "independence", "continuous_learning", "social_impact",
        "high_income", "creativity", "adventure", "structured_environment",
    ]
    work_values = {}
    for i, label in enumerate(work_value_labels):
        work_values[label] = work_value_scores[i] if i < len(work_value_scores) else 3

    return {"riasec_scores": riasec_scores, "work_values": work_values}


def _determine_holland_code(riasec_scores: dict) -> str:
    """Top 3 RIASEC types, ties broken by RIASEC order."""
    riasec_order = {t: i for i, t in enumerate(RIASEC_TYPES)}
    sorted_types = sorted(
        riasec_scores.items(),
        key=lambda x: (-x[1], riasec_order.get(x[0], 99)),
    )
    return "".join(t for t, _ in sorted_types[:3])


def _match_careers(holland_code: str, knowledge_base: list, top_n: int = 10) -> list:
    """Match Holland Code to careers from knowledge base."""
    from engines.scoring_engine import match_careers
    return match_careers(holland_code, knowledge_base, top_n)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


@click.group()
@click.version_option(version="1.0.0", prog_name="CareerNeeti")
def cli():
    """CareerNeeti — AI Career Counselling Report Generator for Indian Schools."""
    pass


# ---- SCORE ----------------------------------------------------------------


@cli.command()
@click.option("--zipgrade-csv", required=True, type=click.Path(exists=True), help="ZipGrade CSV export file")
@click.option("--student-info", required=True, type=click.Path(exists=True), help="Student info CSV (name, class, phone, etc.)")
@click.option("--knowledge-base", type=click.Path(exists=True), default=None, help="Career knowledge base JSON (default: data/career_knowledge_base.json)")
@click.option("--output", "-o", required=True, type=click.Path(), help="Output JSON file for scored profiles")
def score(zipgrade_csv, student_info, knowledge_base, output):
    """Score RIASEC assessments from ZipGrade CSV + student info."""
    click.echo("Loading data...")
    zg_data = _parse_zipgrade_csv(zipgrade_csv)
    student_data = _parse_student_info_csv(student_info)
    kb = _load_knowledge_base(knowledge_base)

    click.echo(f"  ZipGrade responses: {len(zg_data)} students")
    click.echo(f"  Student info: {len(student_data)} students")
    click.echo(f"  Knowledge base: {len(kb)} careers")

    # Merge and score
    from tqdm import tqdm

    profiles = []
    matched_ids = set(zg_data.keys()) & set(student_data.keys())
    unmatched_zg = set(zg_data.keys()) - set(student_data.keys())

    if unmatched_zg:
        click.echo(click.style(f"  Warning: {len(unmatched_zg)} ZipGrade IDs have no matching student info: {sorted(unmatched_zg)[:10]}", fg="yellow"))

    for sid in tqdm(sorted(matched_ids), desc="Scoring", unit="student"):
        raw_responses = zg_data[sid]
        info = student_data[sid]

        result = _calculate_riasec(raw_responses)
        riasec_scores = result["riasec_scores"]
        work_values = result["work_values"]
        holland_code = _determine_holland_code(riasec_scores)
        matched = _match_careers(holland_code, kb)

        # Build full names for scores
        riasec_named = {}
        for t in RIASEC_TYPES:
            riasec_named[RIASEC_TYPE_NAMES[t].lower()] = riasec_scores[t]

        profile = {
            "student_id": sid,
            "name": info.get("name", f"Student {sid}"),
            "class": info.get("class", 10),
            "section": info.get("section", ""),
            "school": info.get("school", ""),
            "city": info.get("city", ""),
            "parent_phone": info.get("parent_phone", ""),
            "parent_name": info.get("parent_name", ""),
            "stream_pref_parent": info.get("stream_pref_parent", ""),
            "stream_pref_student": info.get("stream_pref_student", ""),
            "career_concern": info.get("career_concern", ""),
            "riasec_scores": riasec_scores,
            "riasec_scores_named": riasec_named,
            "holland_code": holland_code,
            "work_values": work_values,
            "matched_careers": matched,
        }
        profiles.append(profile)

    # Write output
    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(profiles, f, indent=2, ensure_ascii=False)

    click.echo(click.style(f"\nScored {len(profiles)} students → {output_path}", fg="green"))

    # Summary
    class_counts: dict[int, int] = {}
    for p in profiles:
        cls = p["class"]
        class_counts[cls] = class_counts.get(cls, 0) + 1
    for cls in sorted(class_counts):
        click.echo(f"  Class {cls}: {class_counts[cls]} students")


# ---- GENERATE -------------------------------------------------------------


@cli.command()
@click.option("--profiles", required=True, type=click.Path(exists=True), help="Scored profiles JSON (output of 'score' command)")
@click.option("--knowledge-base", type=click.Path(exists=True), default=None, help="Career knowledge base JSON")
@click.option("--model", type=click.Choice(["haiku", "gpt4omini", "gemini", "groq"]), default="groq", help="LLM model to use")
@click.option("--output", "-o", required=True, type=click.Path(), help="Output JSON file for generated reports")
@click.option("--dry-run", is_flag=True, help="Process only first 3 students as a test")
@click.option("--max-concurrent", type=int, default=None, help=f"Max concurrent LLM requests (default: {MAX_CONCURRENT_REQUESTS})")
def generate(profiles, knowledge_base, model, output, dry_run, max_concurrent):
    """Generate AI career reports using LLM for each scored student."""
    from engines.report_generator import LLMClient, SYSTEM_PROMPT

    model_map = {"haiku": "anthropic", "gpt4omini": "openai", "gemini": "google", "groq": "groq"}
    provider = model_map[model]

    with open(profiles) as f:
        student_profiles = json.load(f)

    kb = _load_knowledge_base(knowledge_base)
    kb_map = {c["career_id"]: c for c in kb}

    if dry_run:
        student_profiles = student_profiles[:3]
        click.echo(click.style("DRY RUN: processing only 3 students", fg="yellow"))

    click.echo(f"Generating reports for {len(student_profiles)} students with model={model} (provider={provider})")

    from tqdm import tqdm

    llm_client = LLMClient(provider)
    reports = []
    total_cost = 0.0
    failed = []

    for profile in tqdm(student_profiles, desc="Generating", unit="report"):
        try:
            # Get career details for this student
            matched_ids = [m["career_id"] for m in profile.get("matched_careers", [])[:8]]
            career_details = [kb_map[cid] for cid in matched_ids if cid in kb_map]
            if not career_details:
                career_details = kb[:5]

            # Build prompt
            user_prompt = _build_cli_prompt(profile, career_details)
            report_content, cost = llm_client.generate(SYSTEM_PROMPT, user_prompt)

            # Merge cover info
            report_content["cover"] = {
                "student_name": profile["name"],
                "school": profile.get("school", ""),
                "class": profile.get("class", 10),
                "date": time.strftime("%Y-%m-%d"),
                "report_type": "Career Assessment Report",
            }

            report_entry = {
                "student_id": profile["student_id"],
                "name": profile["name"],
                "class": profile.get("class", 10),
                "section": profile.get("section", ""),
                "school": profile.get("school", ""),
                "city": profile.get("city", ""),
                "parent_phone": profile.get("parent_phone", ""),
                "parent_name": profile.get("parent_name", ""),
                "riasec_scores": profile["riasec_scores"],
                "holland_code": profile["holland_code"],
                "work_values": profile.get("work_values", {}),
                "matched_careers": profile.get("matched_careers", []),
                "report_content": report_content,
                "llm_cost": cost,
            }
            reports.append(report_entry)
            total_cost += cost

            tqdm.write(f"  ✓ {profile['name']} (Class {profile.get('class', '?')}) — ${cost:.4f}")

        except Exception as e:
            failed.append({"student_id": profile["student_id"], "name": profile["name"], "error": str(e)})
            tqdm.write(click.style(f"  ✗ {profile['name']}: {e}", fg="red"))

    # Retry failed students once
    if failed:
        click.echo(f"\nRetrying {len(failed)} failed students...")
        retry_failed = []
        for fail_info in failed:
            sid = fail_info["student_id"]
            profile = next((p for p in student_profiles if p["student_id"] == sid), None)
            if not profile:
                continue
            try:
                matched_ids = [m["career_id"] for m in profile.get("matched_careers", [])[:8]]
                career_details = [kb_map[cid] for cid in matched_ids if cid in kb_map]
                if not career_details:
                    career_details = kb[:5]
                user_prompt = _build_cli_prompt(profile, career_details)
                report_content, cost = llm_client.generate(SYSTEM_PROMPT, user_prompt)
                report_content["cover"] = {
                    "student_name": profile["name"],
                    "school": profile.get("school", ""),
                    "class": profile.get("class", 10),
                    "date": time.strftime("%Y-%m-%d"),
                    "report_type": "Career Assessment Report",
                }
                report_entry = {
                    "student_id": profile["student_id"],
                    "name": profile["name"],
                    "class": profile.get("class", 10),
                    "section": profile.get("section", ""),
                    "school": profile.get("school", ""),
                    "city": profile.get("city", ""),
                    "parent_phone": profile.get("parent_phone", ""),
                    "parent_name": profile.get("parent_name", ""),
                    "riasec_scores": profile["riasec_scores"],
                    "holland_code": profile["holland_code"],
                    "work_values": profile.get("work_values", {}),
                    "matched_careers": profile.get("matched_careers", []),
                    "report_content": report_content,
                    "llm_cost": cost,
                }
                reports.append(report_entry)
                total_cost += cost
                click.echo(click.style(f"  ✓ Retry succeeded: {profile['name']}", fg="green"))
            except Exception as e:
                retry_failed.append({"student_id": sid, "name": profile["name"], "error": str(e)})
                click.echo(click.style(f"  ✗ Retry failed: {profile['name']}: {e}", fg="red"))
        failed = retry_failed

    # Write output
    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(reports, f, indent=2, ensure_ascii=False)

    # Summary
    click.echo(click.style(f"\nGeneration complete → {output_path}", fg="green"))
    click.echo(f"  Reports generated: {len(reports)}")
    if failed:
        click.echo(click.style(f"  Failed: {len(failed)}", fg="red"))
        for f_info in failed:
            click.echo(f"    - {f_info['name']}: {f_info['error']}")
    click.echo(f"  Total LLM cost: ${total_cost:.4f}")


def _build_cli_prompt(profile: dict, career_details: list) -> str:
    """Build user prompt for CLI mode (dict-based, not ORM-based)."""
    from config import CLASS_INSTRUCTIONS

    scores = profile.get("riasec_scores", {})
    work_values = profile.get("work_values", {})
    class_level = profile.get("class", 10)

    top_values = sorted(work_values.items(), key=lambda x: -x[1])[:3]
    top_values_str = ", ".join(f"{k} ({v}/5)" for k, v in top_values)

    class_instr = CLASS_INSTRUCTIONS.get(class_level, CLASS_INSTRUCTIONS[10])

    # Stream preference section (for Class 10)
    stream_pref_section = ""
    if class_level == 10:
        parts = []
        sp_parent = profile.get("stream_pref_parent", "")
        sp_student = profile.get("stream_pref_student", "")
        concern = profile.get("career_concern", "")
        if sp_parent:
            parts.append(f"- Parent's suggested stream: {sp_parent}")
        if sp_student:
            parts.append(f"- Student's own preference: {sp_student}")
        if sp_parent and sp_student and sp_parent != sp_student:
            parts.append(f"- NOTE: There is a GAP between parent suggestion ({sp_parent}) and student preference ({sp_student}). Address this directly in the parent section.")
        if concern:
            parts.append(f"- Student's biggest career concern: {concern}")
        if parts:
            stream_pref_section = "\n\nSTREAM PREFERENCE DATA (from student's own assessment):\n" + "\n".join(parts)

    career_json = json.dumps(career_details[:5], indent=2, ensure_ascii=False)

    return f"""STUDENT PROFILE:
- Name: {profile.get('name', 'Student')}
- Class: {class_level}
- School: {profile.get('school', '')}
- City: {profile.get('city', '')}
- RIASEC Scores: R={scores.get('R', 0)}%, I={scores.get('I', 0)}%, A={scores.get('A', 0)}%, S={scores.get('S', 0)}%, E={scores.get('E', 0)}%, C={scores.get('C', 0)}%
- Holland Code: {profile.get('holland_code', '')}
- Top Work Values: {top_values_str}{stream_pref_section}

MATCHED CAREERS FROM DATABASE (use ONLY these facts for career details):
{career_json}

CLASS-SPECIFIC INSTRUCTIONS:
{class_instr}

Generate a complete career assessment report as JSON with this EXACT structure:
{{
  "riasec_profile": {{
    "summary": "2-3 paragraph narrative about what the student's RIASEC profile means",
    "primary_type_description": "Description of their #1 RIASEC type",
    "secondary_type_description": "Description of their #2 RIASEC type",
    "tertiary_type_description": "Description of their #3 RIASEC type"
  }},
  "stream_recommendation": {{
    "recommended_stream": "Science (PCM) / Science (PCB) / Commerce with Maths / Commerce without Maths / Arts / Humanities",
    "confidence": "High / Medium / Low",
    "reasoning": "Why this stream fits their profile",
    "subject_combination": "Specific subjects to choose",
    "alternative_stream": "Backup stream option with reasoning"
  }},
  "career_matches": [
    {{
      "rank": 1,
      "career_name": "Career Name",
      "career_name_hindi": "हिंदी नाम",
      "match_score": 95,
      "why_it_fits": "2-3 sentences explaining why this career matches the student",
      "education_pathway": "Step by step pathway from current class to this career",
      "entrance_exams": ["Exam1", "Exam2"],
      "top_colleges": ["College1 (NIRF #X)", "College2 (NIRF #Y)", "College3 (NIRF #Z)"],
      "salary_range": "Entry: X-Y LPA, Mid: A-B LPA, Senior: C-D LPA",
      "growth_outlook": "Industry growth outlook"
    }}
  ],
  "action_plan": {{
    "next_3_months": ["Action item 1", "Action item 2", "Action item 3"],
    "next_1_year": ["Action item 1", "Action item 2", "Action item 3"],
    "next_2_3_years": ["Action item 1", "Action item 2", "Action item 3"]
  }},
  "parent_section": {{
    "title": "अभिभावकों के लिए / For Parents",
    "recommendation_summary": "Clear summary in simple language for parents",
    "recommendation_summary_hindi": "माता-पिता के लिए सरल भाषा में सारांश",
    "what_to_do_now": ["Specific action 1", "Specific action 2", "Specific action 3"],
    "common_concerns_addressed": "Address job security, salary, social status concerns",
    "how_to_support": "How parents can support their child's career exploration"
  }}
}}

Include exactly 5 careers in career_matches. Make all content specific, actionable, and India-focused."""


# ---- PDF ------------------------------------------------------------------


@cli.command()
@click.option("--reports", required=True, type=click.Path(exists=True), help="Reports JSON (output of 'generate' command)")
@click.option("--output-dir", required=True, type=click.Path(), help="Directory for output PDFs")
@click.option("--counsellor-name", default="", help="Counsellor name for back cover")
@click.option("--counsellor-certification", default="", help="Counsellor certification text")
def pdf(reports, output_dir, counsellor_name, counsellor_certification):
    """Generate branded PDF reports from generated report content."""
    from engines.pdf_generator import generate_radar_chart, generate_bar_chart
    from jinja2 import Environment, FileSystemLoader
    from weasyprint import HTML
    from weasyprint.text.fonts import FontConfiguration
    from config import BRAND_COLORS, TEMPLATES_DIR, FONTS_DIR
    from datetime import date
    from tqdm import tqdm

    with open(reports) as f:
        report_data = json.load(f)

    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    click.echo(f"Generating PDFs for {len(report_data)} students → {out_path}/")

    env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))
    template = env.get_template("report_template.html")

    font_path = FONTS_DIR / "NotoSansDevanagari-Regular.ttf"
    font_url = font_path.as_uri() if font_path.exists() else ""

    generated = 0
    failed_pdfs = []

    for entry in tqdm(report_data, desc="PDF Generation", unit="pdf"):
        try:
            scores = entry.get("riasec_scores", {})
            report = entry.get("report_content", {})
            holland_code = entry.get("holland_code", "")

            radar_chart_b64 = generate_radar_chart(scores)
            bar_chart_b64 = generate_bar_chart(scores)

            context = {
                "student": {
                    "name": entry.get("name", ""),
                    "class_level": entry.get("class", 10),
                    "section": entry.get("section", ""),
                    "holland_code": holland_code,
                    "parent_name": entry.get("parent_name", ""),
                },
                "scores": scores,
                "report": report,
                "radar_chart": radar_chart_b64,
                "bar_chart": bar_chart_b64,
                "brand": BRAND_COLORS,
                "riasec_names": RIASEC_TYPE_NAMES,
                "today": date.today().strftime("%d %B %Y"),
                "font_url": font_url,
                "counsellor_name": counsellor_name,
                "counsellor_certification": counsellor_certification,
            }

            html_content = template.render(**context)

            safe_name = entry.get("name", "student").replace(" ", "_").replace("/", "_")
            sid = entry.get("student_id", "0000")
            cls = entry.get("class", 10)
            filename = f"{sid}_class{cls}_{safe_name}_report.pdf"
            pdf_path = out_path / filename

            font_config = FontConfiguration()
            HTML(string=html_content, base_url=str(TEMPLATES_DIR)).write_pdf(
                str(pdf_path),
                font_config=font_config,
            )
            generated += 1

        except Exception as e:
            failed_pdfs.append({"name": entry.get("name", "?"), "error": str(e)})
            tqdm.write(click.style(f"  ✗ PDF failed for {entry.get('name', '?')}: {e}", fg="red"))

    click.echo(click.style(f"\nPDF generation complete → {out_path}/", fg="green"))
    click.echo(f"  Generated: {generated}")
    if failed_pdfs:
        click.echo(click.style(f"  Failed: {len(failed_pdfs)}", fg="red"))
        for f_info in failed_pdfs:
            click.echo(f"    - {f_info['name']}: {f_info['error']}")


# ---- QA -------------------------------------------------------------------


@cli.command()
@click.option("--reports", required=True, type=click.Path(exists=True), help="Reports JSON to validate")
@click.option("--knowledge-base", type=click.Path(exists=True), default=None, help="Career knowledge base JSON")
@click.option("--output", "-o", type=click.Path(), default=None, help="Output QA report JSON (optional)")
def qa(reports, knowledge_base, output):
    """Run quality assurance checks on generated reports."""
    from engines.qa_checker import load_colleges_whitelist

    with open(reports) as f:
        report_data = json.load(f)

    whitelist = load_colleges_whitelist()

    click.echo(f"Running QA on {len(report_data)} reports...")

    passed = 0
    flagged = 0
    flagged_details = []

    for entry in report_data:
        flags = _validate_report_dict(entry, whitelist)
        if flags:
            flagged += 1
            flagged_details.append({
                "student_id": entry.get("student_id", "?"),
                "name": entry.get("name", "?"),
                "class": entry.get("class", "?"),
                "flags": flags,
            })
        else:
            passed += 1

    # Print summary
    click.echo(f"\n{'='*60}")
    click.echo(f"QA Report")
    click.echo(f"{'='*60}")
    click.echo(f"  Total reports: {len(report_data)}")
    click.echo(click.style(f"  Passed: {passed}", fg="green"))
    if flagged:
        click.echo(click.style(f"  Flagged: {flagged}", fg="red"))
        click.echo(f"\n  FLAGGED REPORTS:")
        for detail in flagged_details:
            click.echo(f"\n  Student {detail['student_id']} ({detail['name']}, Class {detail['class']}):")
            for flag in detail["flags"]:
                click.echo(click.style(f"    - {flag}", fg="yellow"))
    else:
        click.echo(click.style("  All reports passed QA!", fg="green"))

    if output:
        qa_result = {
            "total": len(report_data),
            "passed": passed,
            "flagged": flagged,
            "flagged_details": flagged_details,
        }
        with open(output, "w") as f:
            json.dump(qa_result, f, indent=2, ensure_ascii=False)
        click.echo(f"\n  QA report saved → {output}")


def _validate_report_dict(entry: dict, whitelist: set) -> list[str]:
    """Validate a report entry (dict-based, not ORM). Returns list of flag messages."""
    flags = []
    report = entry.get("report_content", {})

    if not report:
        flags.append("Report content is empty")
        return flags

    # 1. Career matches
    careers = report.get("career_matches", [])
    if len(careers) < 5:
        flags.append(f"Only {len(careers)} career matches (expected 5)")

    for i, career in enumerate(careers):
        if not career.get("career_name"):
            flags.append(f"Career #{i+1} missing career_name")
        if not career.get("why_it_fits"):
            flags.append(f"Career #{i+1} missing why_it_fits")
        if not career.get("education_pathway"):
            flags.append(f"Career #{i+1} missing education_pathway")

    # 2. Stream recommendation consistency
    stream_rec = report.get("stream_recommendation", {})
    if not stream_rec.get("recommended_stream"):
        flags.append("Missing stream recommendation")
    else:
        rec_stream = stream_rec["recommended_stream"].lower()
        if careers:
            top_career = careers[0].get("career_name", "").lower()
            if "arts" in rec_stream and any(
                kw in top_career
                for kw in ["engineer", "data scientist", "doctor", "chartered accountant"]
            ):
                flags.append(
                    f"Stream '{stream_rec['recommended_stream']}' may conflict with #1 career '{careers[0].get('career_name')}'"
                )

    # 3. Class-appropriate content
    class_level = entry.get("class", 10)
    report_text = json.dumps(report)

    if class_level in (8, 9):
        if re.search(r'cutoff.*\d{2,}', report_text, re.IGNORECASE):
            flags.append("Class 8-9 report contains specific cutoff scores")
        if "JEE Advanced" in report_text and "prepare for" in report_text.lower():
            flags.append("Class 8-9 report mentions JEE Advanced preparation")

    if class_level == 10:
        if not stream_rec.get("recommended_stream"):
            flags.append("Class 10 report MUST have a clear stream recommendation")

    if class_level == 12:
        if not report.get("action_plan", {}).get("next_3_months"):
            flags.append("Class 12 report should have immediate action items")

    # 4. Parent section with Hindi
    parent = report.get("parent_section", {})
    if not parent:
        flags.append("Parent section is missing")
    else:
        if not parent.get("recommendation_summary"):
            flags.append("Parent section missing recommendation summary")
        hindi_text = parent.get("recommendation_summary_hindi", "")
        title = parent.get("title", "")
        if not _contains_devanagari(hindi_text) and not _contains_devanagari(title):
            flags.append("Parent section missing Hindi/Devanagari content")

    # 5. Action plan
    action_plan = report.get("action_plan", {})
    if not action_plan:
        flags.append("Action plan is missing")
    elif not action_plan.get("next_3_months") and not action_plan.get("next_1_year"):
        flags.append("Action plan has no items")

    # 6. RIASEC profile
    riasec_profile = report.get("riasec_profile", {})
    if not riasec_profile.get("summary"):
        flags.append("RIASEC profile summary is missing")
    elif len(riasec_profile.get("summary", "")) < 100:
        flags.append("RIASEC profile summary too short")

    # 7. College whitelist check
    if whitelist:
        for career in careers:
            for college in career.get("top_colleges", []):
                if isinstance(college, str):
                    college_name = re.sub(r'\s*\(.*?\)', '', college).strip().lower()
                    if college_name and college_name not in whitelist:
                        fuzzy_match = any(
                            college_name in wl or wl in college_name
                            for wl in whitelist
                        )
                        if not fuzzy_match:
                            flags.append(f"College '{college}' not in whitelist")

    return flags


# ---- SEND -----------------------------------------------------------------


@cli.command()
@click.option("--reports-dir", required=True, type=click.Path(exists=True), help="Directory containing generated PDFs")
@click.option("--student-info", required=True, type=click.Path(exists=True), help="Student info CSV with phone numbers")
@click.option("--method", type=click.Choice(["manual", "whatsapp"]), default="manual", help="Delivery method")
def send(reports_dir, student_info, method):
    """Generate WhatsApp delivery checklist (manual mode) or send via API."""
    student_data = _parse_student_info_csv(student_info)
    pdf_dir = Path(reports_dir)
    pdf_files = sorted(pdf_dir.glob("*.pdf"))

    if not pdf_files:
        click.echo(click.style("No PDF files found in the specified directory.", fg="red"))
        return

    click.echo(f"\nWhatsApp Delivery Checklist — {len(pdf_files)} reports")
    click.echo(f"{'='*70}")
    click.echo(f"{'#':<4} {'Student Name':<25} {'Phone':<15} {'PDF File':<30}")
    click.echo(f"{'-'*70}")

    for i, pdf_file in enumerate(pdf_files, 1):
        # Try to match PDF filename to student
        fname = pdf_file.stem
        matched_info = None
        for sid, info in student_data.items():
            if sid in fname:
                matched_info = info
                break

        name = matched_info.get("name", fname) if matched_info else fname
        phone = matched_info.get("parent_phone", "N/A") if matched_info else "N/A"

        if method == "manual":
            click.echo(f"{i:<4} {name:<25} {phone:<15} {pdf_file.name}")

    click.echo(f"\n{'='*70}")
    click.echo(f"Total: {len(pdf_files)} reports to deliver")
    if method == "manual":
        click.echo("\nManual delivery steps:")
        click.echo("  1. Open WhatsApp Web or WhatsApp Business")
        click.echo("  2. For each student, search the phone number")
        click.echo("  3. Attach the corresponding PDF file")
        click.echo("  4. Send with message: 'Dear Parent, please find your child's Career Assessment Report attached. - CareerNeeti'")


# ---- PIPELINE --------------------------------------------------------------


@cli.command()
@click.option("--zipgrade-csv", required=True, type=click.Path(exists=True), help="ZipGrade CSV export")
@click.option("--student-info", required=True, type=click.Path(exists=True), help="Student info CSV")
@click.option("--knowledge-base", type=click.Path(exists=True), default=None, help="Career knowledge base JSON")
@click.option("--model", type=click.Choice(["haiku", "gpt4omini", "gemini", "groq"]), default="groq", help="LLM model")
@click.option("--output-dir", required=True, type=click.Path(), help="Output directory for all generated files")
@click.option("--counsellor-name", default="", help="Counsellor name for PDF back cover")
@click.option("--dry-run", is_flag=True, help="Process only first 3 students")
def pipeline(zipgrade_csv, student_info, knowledge_base, model, output_dir, counsellor_name, dry_run):
    """Run the full pipeline: score → generate → QA → PDF → delivery checklist."""
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    scored_path = out_path / "scored_profiles.json"
    reports_path = out_path / "reports_content.json"
    qa_path = out_path / "qa_report.json"
    pdf_dir = out_path / "pdfs"

    click.echo(click.style("═" * 60, fg="blue"))
    click.echo(click.style("  CareerNeeti — Full Pipeline", fg="blue", bold=True))
    click.echo(click.style("═" * 60, fg="blue"))

    # Step 1: Score
    click.echo(click.style("\n▶ Step 1/5: Scoring RIASEC assessments...", fg="cyan", bold=True))
    ctx = click.get_current_context()
    ctx.invoke(score, zipgrade_csv=zipgrade_csv, student_info=student_info,
               knowledge_base=knowledge_base, output=str(scored_path))

    # Step 2: Generate
    click.echo(click.style("\n▶ Step 2/5: Generating AI reports...", fg="cyan", bold=True))
    ctx.invoke(generate, profiles=str(scored_path), knowledge_base=knowledge_base,
               model=model, output=str(reports_path), dry_run=dry_run, max_concurrent=None)

    # Step 3: QA
    click.echo(click.style("\n▶ Step 3/5: Running quality assurance...", fg="cyan", bold=True))
    ctx.invoke(qa, reports=str(reports_path), knowledge_base=knowledge_base,
               output=str(qa_path))

    # Step 4: PDF
    click.echo(click.style("\n▶ Step 4/5: Generating PDF reports...", fg="cyan", bold=True))
    ctx.invoke(pdf, reports=str(reports_path), output_dir=str(pdf_dir),
               counsellor_name=counsellor_name, counsellor_certification="")

    # Step 5: Delivery checklist
    click.echo(click.style("\n▶ Step 5/5: Delivery checklist...", fg="cyan", bold=True))
    ctx.invoke(send, reports_dir=str(pdf_dir), student_info=student_info, method="manual")

    # Final summary
    click.echo(click.style("\n" + "═" * 60, fg="green"))
    click.echo(click.style("  Pipeline complete!", fg="green", bold=True))
    click.echo(click.style("═" * 60, fg="green"))
    click.echo(f"  Output directory: {out_path}")
    click.echo(f"  Scored profiles:  {scored_path}")
    click.echo(f"  Report content:   {reports_path}")
    click.echo(f"  QA report:        {qa_path}")
    click.echo(f"  PDFs:             {pdf_dir}/")


if __name__ == "__main__":
    cli()
