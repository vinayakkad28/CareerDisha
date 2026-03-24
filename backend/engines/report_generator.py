"""LLM-based Career Report Generator.

Takes scored student profiles and generates personalized career reports
using class-adaptive prompts. Supports Claude Haiku, GPT-4o-mini, and Gemini Flash.
"""

import json
import asyncio
import time
from typing import Optional

from config import (
    ANTHROPIC_API_KEY,
    OPENAI_API_KEY,
    GOOGLE_API_KEY,
    GROQ_API_KEY,
    LLM_MODELS,
    CLASS_INSTRUCTIONS,
    RIASEC_TYPE_NAMES,
    MAX_CONCURRENT_REQUESTS,
)
from database import SessionLocal
from models import Student


SYSTEM_PROMPT = """You are an expert Indian career counsellor with 20 years of experience guiding students in the Indian education system. You are creating a personalized career report for a school student.

CRITICAL RULES:
- You MUST be specific to India. Reference Indian colleges, Indian entrance exams, Indian salary ranges in LPA.
- NEVER mention SAT, ACT, AP exams, US colleges, or Western education systems.
- ALWAYS use real college names with real NIRF rankings. Never invent institutions.
- Salary figures MUST be in Indian LPA (Lakhs Per Annum) and reflect actual Indian market rates.
- Understand the Indian context: board exams (CBSE/ICSE/State), coaching culture, reservation system, government job aspiration, parental involvement in career decisions.
- Use warm, encouraging tone. Never be discouraging about any career path.
- Address parental concerns practically: job security, social status, salary trajectory, availability in Tier 2/3 cities.
- Include Hindi text in the parent section using Devanagari script.

ETHICAL GUIDELINES:
- This is an INTEREST INVENTORY, not a diagnostic assessment. Make this clear in the summary.
- Interests are not fixed — they develop and change, especially for younger students. Acknowledge this.
- Interest does NOT equal aptitude. Do not guarantee success in any career. Use language like "Your interests align with..." not "You should become..."
- For flat profiles (all scores 40-60%), emphasize that broad interests are normal and recommend diverse exploration rather than specific careers.
- Never make claims about intelligence, talent, or innate ability based on RIASEC scores.
- Address potential parent-student gaps honestly: if the profile suggests creative fields, acknowledge that parents may prefer conventional careers and provide an honest comparison.

You MUST respond with ONLY valid JSON (no markdown, no code blocks). Follow the exact structure specified."""


def build_user_prompt(student: Student, matched_career_details: list) -> str:
    """Build the user prompt with student profile and matched career details."""
    scores = student.riasec_scores or {}
    work_values = student.work_values or {}
    class_level = student.class_level or 10

    # Get top 3 work values
    top_values = sorted(work_values.items(), key=lambda x: -x[1])[:3]
    top_values_str = ", ".join(f"{k} ({v}/5)" for k, v in top_values)

    # Class instructions
    class_instr = CLASS_INSTRUCTIONS.get(class_level, CLASS_INSTRUCTIONS[10])

    # Section D: Class 10 stream preference data
    stream_pref_section = ""
    if class_level == 10:
        parts = []
        if student.stream_pref_parent:
            parts.append(f"- Parent's suggested stream: {student.stream_pref_parent}")
        if student.stream_pref_student:
            parts.append(f"- Student's own preference: {student.stream_pref_student}")
        if student.stream_pref_parent and student.stream_pref_student and student.stream_pref_parent != student.stream_pref_student:
            parts.append(f"- NOTE: There is a GAP between parent suggestion ({student.stream_pref_parent}) and student preference ({student.stream_pref_student}). Address this directly in the parent section.")
        if student.career_concern:
            parts.append(f"- Student's biggest career concern: {student.career_concern}")
        if parts:
            stream_pref_section = "\n\nSTREAM PREFERENCE DATA (from student's own assessment):\n" + "\n".join(parts)

    # Academic marks section (optional)
    academic_section = ""
    marks = student.academic_marks if hasattr(student, 'academic_marks') else None
    if marks:
        marks_parts = [f"- {k.replace('_', ' ').title()}: {v}%" for k, v in marks.items()]
        academic_section = "\n\nACADEMIC PERFORMANCE (self-reported marks):\n" + "\n".join(marks_parts)
        academic_section += "\nIMPORTANT: If any subject mark is below 50% but the career recommendation requires strong performance in that subject, flag this honestly. Recommend additional preparation or alternative pathways. Include a 'Realistic Pathway' alongside the 'Ideal Pathway'."

    # Build career details section
    career_json = json.dumps(matched_career_details[:5], indent=2, ensure_ascii=False)

    return f"""STUDENT PROFILE:
- Name: {student.name}
- Class: {class_level}
- School: (school session)
- City: (assessment session city)
- RIASEC Scores: R={scores.get('R', 0)}%, I={scores.get('I', 0)}%, A={scores.get('A', 0)}%, S={scores.get('S', 0)}%, E={scores.get('E', 0)}%, C={scores.get('C', 0)}%
- Holland Code: {student.holland_code}
- Top Work Values: {top_values_str}{stream_pref_section}{academic_section}

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
    "alternative_stream": "Backup stream option with reasoning",
    "why_this_stream": ["Reason 1 tied to RIASEC scores", "Reason 2", "Reason 3"],
    "subjects_in_stream": [{{"name": "Physics", "brief": "Understanding mechanics, electricity, optics..."}}],
    "what_if_change_mind": "Reassuring paragraph about stream flexibility..."
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
    "next_2_3_years": ["Action item 1", "Action item 2", "Action item 3"],
    "recommended_books": ["Book Title 1 by Author — why it helps", "Book 2", "Book 3"],
    "recommended_youtube": ["Channel Name — what they'll learn", "Channel 2", "Channel 3"],
    "recommended_websites": ["Website — what it offers", "Website 2", "Website 3"],
    "skills_to_develop": [{{"skill": "Skill name", "activity": "Specific activity to practice this"}}]
  }},
  "parent_section": {{
    "title": "अभिभावकों के लिए / For Parents",
    "recommendation_summary": "Clear summary in simple language for parents",
    "recommendation_summary_hindi": "माता-पिता के लिए सरल भाषा में सारांश",
    "what_to_do_now": ["Specific action 1", "Specific action 2", "Specific action 3"],
    "common_concerns_addressed": "Address job security, salary, social status concerns",
    "how_to_support": "How parents can support their child's career exploration",
    "faqs": [
      {{"question_en": "What if my child changes their mind?", "question_hi": "अगर मेरा बच्चा अपना मन बदल ले तो?", "answer_en": "...", "answer_hi": "..."}},
      {{"question_en": "Is this recommendation final?", "question_hi": "क्या यह सिफारिश अंतिम है?", "answer_en": "...", "answer_hi": "..."}},
      {{"question_en": "How can I support without pressuring?", "question_hi": "बिना दबाव डाले मैं कैसे सहयोग करूं?", "answer_en": "...", "answer_hi": "..."}},
      {{"question_en": "What about financial constraints?", "question_hi": "आर्थिक सीमाओं के बारे में क्या?", "answer_en": "...", "answer_hi": "..."}}
    ],
    "conversation_starters": ["Question for parent to ask child 1", "Question 2", "Question 3"]
  }},
  "personal_note": "Dear {{{{name}}}}, ... (2-3 warm paragraphs addressing the student directly in second person. Reference their specific RIASEC strengths. Be encouraging and specific to their profile.)"
}}

Include exactly 5 careers in career_matches. Make all content specific, actionable, and India-focused.

Make recommended_books, recommended_youtube, and recommended_websites REAL — use actual Indian book titles, actual YouTube channel names (like Physics Wallah, Unacademy, Khan Academy Hindi), and actual websites (SWAYAM, NPTEL, Coursera). Do NOT invent fictional resources."""


class LLMClient:
    """Abstraction over multiple LLM providers."""

    def __init__(self, provider: str = "anthropic"):
        self.provider = provider

    def generate(self, system_prompt: str, user_prompt: str) -> tuple[dict, float]:
        """Generate report content. Returns (parsed_json, cost_usd)."""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                if self.provider == "anthropic":
                    return self._call_anthropic(system_prompt, user_prompt)
                elif self.provider == "openai":
                    return self._call_openai(system_prompt, user_prompt)
                elif self.provider == "google":
                    return self._call_google(system_prompt, user_prompt)
                elif self.provider == "groq":
                    return self._call_groq(system_prompt, user_prompt)
                else:
                    raise ValueError(f"Unknown provider: {self.provider}")
            except Exception as e:
                if attempt < max_retries - 1:
                    wait = 2 ** (attempt + 1)
                    print(f"  Retry {attempt + 1}/{max_retries} after {wait}s: {e}")
                    time.sleep(wait)
                else:
                    raise

    def _call_anthropic(self, system_prompt: str, user_prompt: str) -> tuple[dict, float]:
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = client.messages.create(
            model=LLM_MODELS["anthropic"],
            max_tokens=8192,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        text = response.content[0].text
        # Parse JSON from response (handle potential markdown wrapping)
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        parsed = json.loads(text)

        # Calculate cost (Haiku pricing: $0.25/MTok input, $1.25/MTok output)
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        cost = (input_tokens * 0.25 + output_tokens * 1.25) / 1_000_000
        return parsed, cost

    def _call_openai(self, system_prompt: str, user_prompt: str) -> tuple[dict, float]:
        import openai
        client = openai.OpenAI(api_key=OPENAI_API_KEY)
        response = client.chat.completions.create(
            model=LLM_MODELS["openai"],
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=8192,
            response_format={"type": "json_object"},
        )
        text = response.choices[0].message.content
        parsed = json.loads(text)

        # GPT-4o-mini pricing: $0.15/MTok input, $0.60/MTok output
        input_tokens = response.usage.prompt_tokens
        output_tokens = response.usage.completion_tokens
        cost = (input_tokens * 0.15 + output_tokens * 0.60) / 1_000_000
        return parsed, cost

    def _call_google(self, system_prompt: str, user_prompt: str) -> tuple[dict, float]:
        import google.generativeai as genai
        genai.configure(api_key=GOOGLE_API_KEY)
        model = genai.GenerativeModel(
            LLM_MODELS["google"],
            system_instruction=system_prompt,
        )
        response = model.generate_content(
            user_prompt,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
                max_output_tokens=8192,
            ),
        )
        parsed = json.loads(response.text)
        # Gemini Flash is free tier / very cheap
        cost = 0.0
        return parsed, cost

    def _call_groq(self, system_prompt: str, user_prompt: str) -> tuple[dict, float]:
        import openai
        client = openai.OpenAI(
            api_key=GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
        )
        response = client.chat.completions.create(
            model=LLM_MODELS["groq"],
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=8192,
            response_format={"type": "json_object"},
        )
        text = response.choices[0].message.content
        parsed = json.loads(text)
        # Groq free tier: $0 cost
        cost = 0.0
        return parsed, cost


def get_career_details_for_student(student: Student, knowledge_base: list) -> list:
    """Get full career details for student's matched careers."""
    matched = student.matched_careers or []
    career_ids = [m["career_id"] for m in matched[:8]]
    kb_map = {c["career_id"]: c for c in knowledge_base}
    return [kb_map[cid] for cid in career_ids if cid in kb_map]


def generate_single_report(
    student: Student,
    knowledge_base: list,
    provider: str = "anthropic",
    db=None,
) -> float:
    """Generate a report for a single student. Returns LLM cost."""
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        career_details = get_career_details_for_student(student, knowledge_base)
        if not career_details:
            # Fallback: use first 5 careers from KB
            career_details = knowledge_base[:5]

        user_prompt = build_user_prompt(student, career_details)
        client = LLMClient(provider)
        report_content, cost = client.generate(SYSTEM_PROMPT, user_prompt)

        # Merge cover info into report
        report_content["cover"] = {
            "student_name": student.name,
            "class": student.class_level,
            "holland_code": student.holland_code,
            "date": time.strftime("%Y-%m-%d"),
        }

        student.report_content = report_content
        student.report_status = "report_generated"
        student.llm_cost = cost
        db.commit()

        return cost
    finally:
        if close_db:
            db.close()
