"""LLM-based Career Report Generator.

Takes scored student profiles and generates personalized career reports
using class-adaptive prompts. Supports Claude Haiku, GPT-4o-mini, and Gemini Flash.
"""

import json
import asyncio
import logging
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
    LLM_TIMEOUT_SECONDS,
)
from database import SessionLocal
from models import Student

logger = logging.getLogger(__name__)

# Failures that will recur identically on every attempt, so retrying is waste.
# Referenced by name to avoid importing every provider SDK at module import time.
_PERMANENT_LLM_ERROR_NAMES = {
    "AuthenticationError",      # bad or missing API key
    "PermissionDeniedError",
    "BadRequestError",          # malformed request / unsupported model
    "NotFoundError",            # unknown model id
    "UnprocessableEntityError",
    "ValueError",               # our own "Unknown provider"
}


def _is_permanent_llm_error(exc: BaseException) -> bool:
    """True for provider errors that will fail identically on every retry.

    Checked with an explicit call rather than an `except` clause: CPython matches
    exceptions with PyErr_GivenExceptionMatches, which does NOT consult a custom
    __instancecheck__. An earlier attempt used a virtual base class here, so
    isinstance() reported True while the except clause silently fell through to
    the retry branch — a permanent 404 ("model does not exist or you do not have
    access to it") burned all nine attempts before surfacing.
    """
    if type(exc).__name__ in _PERMANENT_LLM_ERROR_NAMES:
        return True
    # Providers also signal these as plain HTTP status codes.
    status = getattr(exc, "status_code", None)
    return status in (400, 401, 403, 404, 422)


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
- Present career matches as tiers (Strong Fit / Good Fit / Worth Exploring), not precise ranked percentages.

SOCIOECONOMIC AWARENESS:
- If family income data is provided, tailor college recommendations to include affordable options (government colleges, scholarship pathways, education loans via Vidyalakshmi portal).
- For Tier 2/3 city students, emphasize careers with strong local availability and remote work options.
- For first-generation learners, provide extra guidance on college application processes and include mentorship suggestions.
- Address coaching reality honestly: when coaching is essential vs optional vs unnecessary, online alternatives vs physical coaching, approximate costs.

SELF-EFFICACY INTEGRATION:
- If self-efficacy scores are provided alongside RIASEC, note any interest-confidence mismatches. Example: high Investigative interest but low science self-efficacy = recommend confidence-building activities, not just career matches.
- When self-efficacy is low in a domain the student shows interest in, include specific suggestions to build confidence (online courses, competitions, mentors).

FINANCIAL PLANNING:
- For EACH career recommendation, include approximate total education cost (government vs private college).
- Mention relevant scholarships (National Scholarship Portal, state scholarships, institution-specific).
- Include a brief note on education loan options and expected ROI timeline.

DEEP REPORT REQUIREMENTS:
- personality_portrait.who_you_are must be at least 300 words, written in second person ("you"), specific to THIS student's exact score pattern. Make them feel truly understood.
- career_deep_dive.day_in_the_life must be at least 150 words and read like a scene from a novel — specific, sensory, exciting.
- career_deep_dive.journey_map must cover all 7 stages with concrete, actionable items at each stage.
- stream_comparison.all_streams must include ALL FIVE streams evaluated for this student. Never skip a stream.
- hidden_gems must be careers this student is unlikely to know — avoid Software Engineer, Doctor, Engineer. Think: UX Researcher, Actuary, Science Journalist, Clinical Psychologist, Biomechanical Engineer.
- financial_roadmap.roi_simple must use actual numbers (do the math).
- financial_roadmap.top_scholarships must be REAL named scholarships relevant to this career path.
- confidence_builder.your_evidence must reference specific aspects of their actual responses, not be generic.

You MUST respond with ONLY valid JSON (no markdown, no code blocks). Follow the exact structure specified."""


def build_user_prompt(student: Student, matched_career_details: list) -> str:
    """Build the user prompt with student profile and matched career details."""
    scores = student.riasec_scores or {}
    work_values = student.work_values or {}
    class_level = student.class_level or 10

    # Detect D2C vs school context
    is_d2c = hasattr(student, 'd2c_assessment_id') and student.d2c_assessment_id is not None
    school_line = "CareerNeeti Online Assessment" if is_d2c else "(school session)"
    city_line = student.location_type.title() if (hasattr(student, 'location_type') and student.location_type) else "(assessment session city)"

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

    # Socioeconomic context section
    context_section = ""
    context_parts = []
    if hasattr(student, 'gender') and student.gender:
        context_parts.append(f"- Gender: {student.gender}")
    if hasattr(student, 'family_income') and student.family_income:
        income_labels = {"below_3l": "Below ₹3 Lakh/year", "3_10l": "₹3-10 Lakh/year", "10_25l": "₹10-25 Lakh/year", "above_25l": "Above ₹25 Lakh/year"}
        context_parts.append(f"- Family Income: {income_labels.get(student.family_income, student.family_income)}")
    if hasattr(student, 'location_type') and student.location_type:
        context_parts.append(f"- Location: {student.location_type.title()} city")
    if hasattr(student, 'parental_education') and student.parental_education:
        context_parts.append(f"- Parental Education: {student.parental_education.replace('_', ' ').title()}")
    if hasattr(student, 'first_gen_learner') and student.first_gen_learner:
        context_parts.append("- First-Generation College Learner: Yes (provide extra guidance on applications)")
    if context_parts:
        context_section = "\n\nSOCIOECONOMIC CONTEXT:\n" + "\n".join(context_parts)
        context_section += "\nADAPT recommendations based on this context. Include affordable college options, scholarship pathways, and locally available careers."

    # Self-efficacy section
    se_section = ""
    se = student.self_efficacy if hasattr(student, 'self_efficacy') and student.self_efficacy else None
    if se:
        se_parts = [f"- {domain.title()}: {score}/5" for domain, score in se.items()]
        se_section = "\n\nSELF-EFFICACY SCORES (student's confidence in each domain):\n" + "\n".join(se_parts)
        # Flag interest-confidence mismatches
        if scores:
            riasec_to_domain = {"I": "science", "R": "maths", "A": "arts", "E": "business", "S": "social"}
            for rtype, domain in riasec_to_domain.items():
                interest = scores.get(rtype, 0)
                confidence = se.get(domain, 3)
                if interest > 70 and confidence <= 2:
                    se_section += f"\nWARNING: High {rtype} interest ({interest}%) but LOW {domain} confidence ({confidence}/5). Address this mismatch — recommend confidence-building activities."

    # Aptitude scores section
    apt_section = ""
    apt = student.aptitude_scores if hasattr(student, 'aptitude_scores') and student.aptitude_scores else None
    if apt:
        apt_parts = [f"- {k.title()}: {v}%" for k, v in apt.items()]
        apt_section = "\n\nAPTITUDE TEST SCORES:\n" + "\n".join(apt_parts)
        apt_section += "\nUse these aptitude scores alongside RIASEC interests when recommending careers. High numerical aptitude supports engineering/finance careers; high verbal supports law/journalism; high spatial supports architecture/design."

    # Family context section
    family_section = ""
    family_parts = []
    if hasattr(student, 'coaching_affordability') and student.coaching_affordability:
        labels = {"yes_easily": "Yes, easily affordable", "yes_difficult": "Yes, but with difficulty", "no": "No, not affordable"}
        family_parts.append(f"- Coaching Affordability: {labels.get(student.coaching_affordability, student.coaching_affordability)}")
    if hasattr(student, 'mobility_willingness') and student.mobility_willingness:
        family_parts.append(f"- Willing to Relocate for College: {student.mobility_willingness.title()}")
    if hasattr(student, 'parent_primary_concern') and student.parent_primary_concern:
        family_parts.append(f"- Parent's Primary Concern: {student.parent_primary_concern.replace('_', ' ').title()}")
    if hasattr(student, 'family_career_role_model') and student.family_career_role_model:
        family_parts.append(f"- Family Career Role Model: {student.family_career_role_model}")
    if family_parts:
        family_section = "\n\nFAMILY CONTEXT:\n" + "\n".join(family_parts)
        family_section += "\nADAPT recommendations considering family constraints. If coaching is not affordable, recommend free alternatives (YouTube channels, NPTEL, government coaching schemes). If mobility is limited, emphasize local opportunities and remote work careers."

    # Big Five personality section
    bf_section = ""
    bf = student.big_five_scores if hasattr(student, 'big_five_scores') and student.big_five_scores else None
    if bf:
        trait_names = {"O": "Openness", "C": "Conscientiousness", "E": "Extraversion", "A": "Agreeableness", "N": "Neuroticism"}
        bf_parts = [f"- {trait_names.get(k, k)}: {v}%" for k, v in bf.items()]
        bf_section = "\n\nPERSONALITY PROFILE (TIPI — broad tendencies, not precise measurements):\n" + "\n".join(bf_parts)
        if bf.get("N", 0) > 70:
            bf_section += f"\nNOTE: Elevated anxiety tendency ({bf['N']}%). Common in board exam culture — not pathological. Recommend confidence-building and stress management support."
        bf_section += "\nUse personality data to enrich the personality portrait. High O supports creative careers; high C supports structured careers; high E supports people-facing roles. Do NOT use personality as primary stream signal."

    # Career readiness section
    cr_section = ""
    cr_score = student.career_readiness_score if hasattr(student, 'career_readiness_score') and student.career_readiness_score is not None else None
    cr_level = student.career_readiness_level if hasattr(student, 'career_readiness_level') and student.career_readiness_level else ""
    if cr_score is not None:
        level_labels = {"decision_ready": "Decision Ready", "exploring": "Exploring", "early_stage": "Early Stage", "undecided": "Undecided"}
        cr_section = f"\n\nCAREER READINESS: {cr_score}% ({level_labels.get(cr_level, cr_level)})"
        if cr_level in ("early_stage", "undecided"):
            cr_section += "\nStudent has not yet seriously explored career options. Use exploratory, encouraging framing regardless of class level. Emphasize that it is normal and okay to be unsure at this stage."
        elif cr_level == "exploring":
            cr_section += "\nStudent is actively thinking about careers but not yet decided. Use 'good fit worth exploring' framing rather than definitive 'choose this' language."
        else:
            cr_section += "\nStudent is ready to commit to a stream. Use confident, actionable recommendation framing."

    # Build career details section
    career_json = json.dumps(matched_career_details[:5], indent=2, ensure_ascii=False)

    return f"""STUDENT PROFILE:
- Name: {student.name}
- Class: {class_level}
- School: {school_line}
- City: {city_line}
- RIASEC Scores: R={scores.get('R', 0)}%, I={scores.get('I', 0)}%, A={scores.get('A', 0)}%, S={scores.get('S', 0)}%, E={scores.get('E', 0)}%, C={scores.get('C', 0)}%
- Holland Code: {student.holland_code}
- Top Work Values: {top_values_str}{stream_pref_section}{academic_section}{context_section}{se_section}{apt_section}{family_section}{bf_section}{cr_section}

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
      "growth_outlook": "Industry growth outlook",
      "education_cost": "Govt college: X Lakh, Private: Y Lakh total",
      "scholarship_options": "Relevant scholarships (e.g., National Scholarship Portal, INSPIRE, state schemes)",
      "coaching_needed": "Yes/No/Optional — with honest assessment and cost comparison"
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
  "personal_note": "Dear {{{{name}}}}, ... (2-3 warm paragraphs addressing the student directly in second person. Reference their specific RIASEC strengths. Be encouraging and specific to their profile.)",

  "personality_portrait": {{
    "who_you_are": "3-4 paragraph personal portrait of this student (minimum 300 words). Written directly to the student in second person. Specific to their exact RIASEC pattern, not just their top type. Explain what kind of thinker they are, what environments make them thrive, how they approach problems, what they find meaningful. Make it feel like someone who truly knows them.",
    "your_strengths": ["Strength 1 with a real-world example of how this shows up", "Strength 2", "Strength 3", "Strength 4", "Strength 5"],
    "what_energizes_you": "Specific description of the environments, tasks, and problems that will make this student excited to go to work",
    "natural_challenges": "1-2 things this profile typically struggles with — framed constructively as areas to develop",
    "your_future_self": "A paragraph about the kind of professional this student is becoming — not a job title but a description. In 10 years, you will likely be the person who..."
  }},

  "career_deep_dive": {{
    "career_name": "Career #1 name (the strongest match from career_matches)",
    "day_in_the_life": "Write a vivid, specific 200-word paragraph: a Tuesday morning in 2025 for a [career] professional in India. Real tasks (e.g., At 10am, she is reviewing her model precision-recall curve on a Bangalore fintech dataset). Real environment. Real colleagues. Make it exciting.",
    "why_this_fits_you_deeply": "3-4 paragraphs connecting specific RIASEC scores to specific aspects of this career. Not generic. Reference actual score values. E.g., Your Investigative score of 78% means you need work where there are no fixed answers...",
    "the_honest_truth": "2 paragraphs about real challenges: what is hard, what the frustrating parts are, what people do not tell you. Be honest and specific. This builds trust and prepares the student.",
    "journey_map": [
      {{"stage": "Now (Class 10)", "actions": ["2-3 specific things to do this year"]}},
      {{"stage": "Class 11-12", "actions": ["Stream choice, key subjects to master, competitions to enter"]}},
      {{"stage": "After 12th (Age 17-18)", "actions": ["Entrance exam strategy, college selection approach"]}},
      {{"stage": "College Years (Age 18-22)", "actions": ["Internships, projects, skills to build"]}},
      {{"stage": "First Job (Age 22-23)", "description": "What entry-level reality looks like — actual job title, typical company, typical salary range"}},
      {{"stage": "5 Years In (Age 27)", "description": "What career looks like with experience — role, responsibilities, typical CTC"}},
      {{"stage": "10 Years In (Age 32)", "description": "Senior professional — what leadership looks like in this career"}}
    ],
    "salary_by_company_tier": {{
      "tier1_mnc": "Rs X-Y LPA (Google, Amazon, Microsoft)",
      "tier2_it": "Rs A-B LPA (TCS, Infosys, Wipro)",
      "startup": "Rs C-D LPA (funded startup with ESOPs)",
      "government": "Rs E-F LPA (ISRO, DRDO, PSU equivalent if applicable)"
    }}
  }},

  "stream_comparison": {{
    "all_streams": [
      {{
        "stream": "Science (PCM)",
        "fit": "Strong / Moderate / Weak",
        "fit_reason": "1-2 specific sentences tied to their RIASEC scores",
        "opens": ["3 career paths this enables"],
        "challenge_for_this_profile": "What will be hard for this specific RIASEC pattern in this stream"
      }}
    ],
    "decision_framework": "3 questions the student can answer to confirm their choice. E.g., If you enjoy figuring out how machines work then PCM. If living systems fascinate you more than circuits then PCB."
  }},

  "hidden_gems": [
    {{
      "career_name": "Career name (lesser-known but strong match)",
      "why_you_probably_never_considered_it": "The real reason this career is invisible to most Indian students",
      "what_it_actually_is": "Plain language explanation in 2-3 sentences",
      "why_it_fits_your_profile": "Specific connection to RIASEC scores",
      "salary_snapshot": "Entry: Rs X LPA, with 5 years: Rs Y LPA",
      "first_step": "One concrete thing to do this week to explore this career"
    }}
  ],

  "financial_roadmap": {{
    "education_cost": {{
      "government_college": "Rs X Lakh total for 4-year degree (including hostel)",
      "private_college_mid": "Rs Y Lakh total for 4 years at mid-tier private",
      "private_college_top": "Rs Z Lakh total for 4 years at top private"
    }},
    "earnings_timeline": [
      {{"period": "Year 1 (Age 22)", "ctc": "Rs X-Y LPA", "note": "Entry level, typical company"}},
      {{"period": "Year 3 (Age 24)", "ctc": "Rs A-B LPA", "note": "After promotion / job switch"}},
      {{"period": "Year 5 (Age 26)", "ctc": "Rs C-D LPA", "note": "Mid-level professional"}},
      {{"period": "Year 10 (Age 31)", "ctc": "Rs E-F LPA", "note": "Senior / specialist role"}}
    ],
    "roi_simple": "At a government college (Rs X Lakh cost) earning Rs Y LPA in Year 1, you recover your full education investment in N months. At a private college (Rs Z Lakh), it takes M months.",
    "top_scholarships": [
      {{
        "name": "Real scholarship name (e.g., INSPIRE Scholarship, KVPY, NSP Central Sector)",
        "amount": "Rs X per year",
        "eligibility": "Specific eligibility criteria for this student stream/career",
        "how_to_apply": "Specific portal/deadline"
      }}
    ],
    "education_loan_guidance": "Vidyalakshmi portal (vidyalakshmi.co.in) — typical interest 8-12%, moratorium during study + 1 year, EMI starts at Rs X/month for Rs Y lakh loan"
  }},

  "confidence_builder": {{
    "your_confidence_snapshot": "Warm, honest 1-2 paragraph analysis of self-efficacy scores. What they mean and what they do not mean. If no SE data: acknowledge and give general encouragement.",
    "gap_analysis": "If any interest > confidence gaps detected: address directly. E.g., You have high interest in science but feel less confident — this is extremely common and here is why it does not define your potential...",
    "thirty_day_challenges": [
      {{"challenge": "Specific activity (e.g., Complete one module of NPTEL Python course)", "why": "What this will prove to you about yourself"}},
      {{"challenge": "Second challenge", "why": "Its purpose"}},
      {{"challenge": "Third challenge", "why": "Its purpose"}}
    ],
    "your_evidence": "A specific, evidence-based paragraph: The fact that you answered these questions the way you did tells us that [specific evidence from their response pattern]. This is not motivation — it is data."
  }}
}}

Include exactly 5 careers in career_matches. Include exactly 2 careers in hidden_gems. stream_comparison.all_streams must have exactly 5 entries (Science PCM, Science PCB, Commerce with Maths, Commerce without Maths, Arts/Humanities). financial_roadmap.top_scholarships must have at least 3 real, named scholarships. Make all content specific, actionable, and India-focused.

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
                if _is_permanent_llm_error(e):
                    # A bad key, a retired model or a malformed request fails
                    # identically every time; retrying only delays the error.
                    logger.error(f"LLM call failed permanently ({type(e).__name__}): {e}")
                    raise
                if attempt < max_retries - 1:
                    wait = 2 ** (attempt + 1)
                    logger.warning(f"LLM retry {attempt + 1}/{max_retries} after {wait}s: {e}")
                    time.sleep(wait)
                else:
                    raise

    def _call_anthropic_single(self, system_prompt: str, user_prompt: str) -> tuple[dict, float]:
        """Single Anthropic API call. Returns (parsed_json, cost_usd)."""
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY, timeout=LLM_TIMEOUT_SECONDS, max_retries=0)
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

    def _call_anthropic(self, system_prompt: str, user_prompt: str) -> tuple[dict, float]:
        """Two-pass Anthropic generation to fit within 8192 max_tokens per call."""
        # Pass 1: Generate core sections only
        pass1_suffix = (
            "\n\nIMPORTANT: In this response, generate ONLY these top-level JSON keys: "
            "riasec_profile, stream_recommendation, career_matches, action_plan, "
            "parent_section, personal_note. Do NOT include personality_portrait, "
            "career_deep_dive, stream_comparison, hidden_gems, financial_roadmap, "
            "or confidence_builder — those will be generated separately."
        )
        result1, cost1 = self._call_anthropic_single(system_prompt, user_prompt + pass1_suffix)

        # Pass 2: Generate new expanded sections with Pass 1 as context
        pass1_summary = json.dumps(result1, ensure_ascii=False)[:4000]
        pass2_suffix = (
            f"\n\nIMPORTANT: The following sections have ALREADY been generated:\n"
            f"{pass1_summary}\n\n"
            f"In this response, generate ONLY these top-level JSON keys: "
            f"personality_portrait, career_deep_dive, stream_comparison, hidden_gems, "
            f"financial_roadmap, confidence_builder. Do NOT include riasec_profile, "
            f"stream_recommendation, career_matches, action_plan, parent_section, "
            f"or personal_note. Ensure consistency with the already-generated content above."
        )
        result2, cost2 = self._call_anthropic_single(system_prompt, user_prompt + pass2_suffix)

        # Merge both results
        merged = {**result1, **result2}
        return merged, cost1 + cost2

    def _call_openai(self, system_prompt: str, user_prompt: str) -> tuple[dict, float]:
        import openai
        client = openai.OpenAI(
            api_key=OPENAI_API_KEY,
            timeout=LLM_TIMEOUT_SECONDS,
            max_retries=0,
        )
        response = client.chat.completions.create(
            model=LLM_MODELS["openai"],
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=12000,
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
                max_output_tokens=12000,
            ),
        )
        parsed = json.loads(response.text)
        # Gemini Flash is free tier / very cheap
        cost = 0.0
        return parsed, cost

    def _call_groq(self, system_prompt: str, user_prompt: str) -> tuple[dict, float]:
        import openai
        client = openai.OpenAI(
            timeout=LLM_TIMEOUT_SECONDS,
            max_retries=0,
            api_key=GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
        )
        response = client.chat.completions.create(
            model=LLM_MODELS["groq"],
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=12000,
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
