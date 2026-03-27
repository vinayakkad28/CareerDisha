"""Free stream predictor quiz — public, no auth required."""

import logging
from fastapi import APIRouter
from pydantic import BaseModel

from database import SessionLocal
from models import Lead

logger = logging.getLogger(__name__)
router = APIRouter()

# 15 mini-RIASEC questions (2-3 per type, simplified for quick quiz)
QUIZ_QUESTIONS = [
    {"id": 1, "text": "I enjoy solving maths and science problems", "text_hi": "मुझे गणित और विज्ञान की समस्याएँ हल करना पसंद है", "type": "I"},
    {"id": 2, "text": "I like working with my hands — building, fixing, or creating things", "text_hi": "मुझे अपने हाथों से काम करना पसंद है", "type": "R"},
    {"id": 3, "text": "I enjoy drawing, writing, music, or other creative activities", "text_hi": "मुझे चित्रकला, लेखन, संगीत पसंद है", "type": "A"},
    {"id": 4, "text": "I like helping people and working in teams", "text_hi": "मुझे लोगों की मदद करना और टीम में काम करना पसंद है", "type": "S"},
    {"id": 5, "text": "I enjoy leading groups and convincing others", "text_hi": "मुझे समूह का नेतृत्व करना और लोगों को समझाना पसंद है", "type": "E"},
    {"id": 6, "text": "I like organizing data, keeping records, and following rules", "text_hi": "मुझे डेटा व्यवस्थित करना और नियम पालन करना पसंद है", "type": "C"},
    {"id": 7, "text": "I enjoy learning about technology and new discoveries", "text_hi": "मुझे तकनीक और नई खोजों के बारे में सीखना पसंद है", "type": "I"},
    {"id": 8, "text": "I like outdoor activities and physical work", "text_hi": "मुझे बाहरी गतिविधियाँ और शारीरिक काम पसंद है", "type": "R"},
    {"id": 9, "text": "I enjoy expressing ideas creatively — through design, videos, or content", "text_hi": "मुझे विचारों को रचनात्मक तरीके से व्यक्त करना पसंद है", "type": "A"},
    {"id": 10, "text": "I like talking to many people and understanding their views", "text_hi": "मुझे कई लोगों से बात करना और उनके विचार समझना पसंद है", "type": "S"},
    {"id": 11, "text": "I enjoy managing money, planning budgets, or selling things", "text_hi": "मुझे पैसे का प्रबंधन करना पसंद है", "type": "E"},
    {"id": 12, "text": "I like working with numbers, spreadsheets, and detailed tasks", "text_hi": "मुझे संख्याओं और विस्तृत कार्यों पर काम करना पसंद है", "type": "C"},
    {"id": 13, "text": "I enjoy experiments and understanding how things work", "text_hi": "मुझे प्रयोग करना और चीज़ों को समझना पसंद है", "type": "I"},
    {"id": 14, "text": "I like starting new projects and taking risks", "text_hi": "मुझे नई परियोजनाएँ शुरू करना और जोखिम लेना पसंद है", "type": "E"},
    {"id": 15, "text": "I enjoy caring for others and making them feel comfortable", "text_hi": "मुझे दूसरों की देखभाल करना पसंद है", "type": "S"},
]

class QuizSubmission(BaseModel):
    answers: dict[str, int]  # {"1": 4, "2": 2, ...} question_id: score (1-5)
    student_name: str = ""
    parent_phone: str = ""
    class_level: int = 10
    email: str = ""
    utm_source: str = ""
    utm_medium: str = ""
    utm_campaign: str = ""


# ── Scoring helpers (shared with d2c.py) ──────────────────────

def detect_straight_lining(answers: dict[str, int]) -> bool:
    """Returns True if 85%+ of answers are the same value."""
    from collections import Counter
    values = list(answers.values())
    if not values:
        return True
    counts = Counter(values)
    return counts.most_common(1)[0][1] / len(values) > 0.85


def is_flat_profile(riasec_pct: dict, threshold: float = 10.0) -> bool:
    """Returns True if max - min RIASEC score < threshold."""
    values = list(riasec_pct.values())
    if not values:
        return True
    return (max(values) - min(values)) < threshold


def determine_stream(sorted_types: list[tuple[str, float]]) -> str | None:
    """Map RIASEC profile to Indian education stream. Returns None if unclear."""
    if len(sorted_types) < 2:
        return None
    top1, top2 = sorted_types[0][0], sorted_types[1][0]

    if top1 in ("I", "R") and top2 in ("I", "R"):
        return "Science (PCM)"
    if (top1 == "I" and top2 == "S") or (top1 == "S" and top2 == "I"):
        return "Science (PCB)"
    if top1 in ("E", "C") and top2 in ("E", "C"):
        return "Commerce"
    if top1 == "A":
        return "Arts / Humanities"
    if top1 == "S" and top2 == "A":
        return "Arts / Humanities"
    if top1 == "S" and top2 == "E":
        return "Commerce"
    if top1 == "E":
        return "Commerce"
    if top1 == "I":
        return "Science (PCM)"
    if top1 == "R":
        return "Science (PCM)"
    if top1 == "C":
        return "Commerce"
    if top1 == "S":
        return "Arts / Humanities"
    return None


def calculate_recommendation(riasec_pct: dict, answers: dict[str, int]) -> dict:
    """Single source of truth for stream, confidence, and message text."""
    sorted_types = sorted(riasec_pct.items(), key=lambda x: -x[1])
    gap = sorted_types[0][1] - sorted_types[1][1] if len(sorted_types) > 1 else 0

    straight_lined = detect_straight_lining(answers)
    flat = is_flat_profile(riasec_pct)

    # Flat or straight-lined → no recommendation
    if flat or straight_lined:
        return {
            "stream": None,
            "confidence": "Insufficient",
            "message": (
                "Your responses show similar interest levels across all areas. "
                "This usually happens when questions are answered the same way throughout. "
                "For an accurate career profile, please retake the assessment \u2014 "
                "answer each question based on what YOU genuinely enjoy, not what you think is the 'right' answer."
            ),
            "message_hi": (
                "\u0906\u092a\u0915\u0947 \u0909\u0924\u094d\u0924\u0930 \u0938\u092d\u0940 \u0915\u094d\u0937\u0947\u0924\u094d\u0930\u094b\u0902 \u092e\u0947\u0902 \u0938\u092e\u093e\u0928 \u0930\u0941\u091a\u093f \u0926\u093f\u0916\u093e\u0924\u0947 \u0939\u0948\u0902\u0964 "
                "\u0938\u091f\u0940\u0915 \u092a\u0930\u093f\u0923\u093e\u092e \u0915\u0947 \u0932\u093f\u090f, \u0915\u0943\u092a\u092f\u093e \u092a\u094d\u0930\u0924\u094d\u092f\u0947\u0915 \u092a\u094d\u0930\u0936\u094d\u0928 \u0915\u093e \u0909\u0924\u094d\u0924\u0930 \u0905\u092a\u0928\u0940 \u0935\u093e\u0938\u094d\u0924\u0935\u093f\u0915 \u092a\u0938\u0902\u0926 \u0915\u0947 \u0905\u0928\u0941\u0938\u093e\u0930 \u0926\u0947\u0902\u0964"
            ),
            "is_flat": True,
        }

    stream = determine_stream(sorted_types)

    if stream is None or gap < 5:
        return {
            "stream": None,
            "confidence": "Insufficient",
            "message": (
                "Your interest profile doesn\u2019t clearly point to one stream over another. "
                "This is common and means you have diverse interests. "
                "A detailed assessment with a counsellor can help narrow this down."
            ),
            "message_hi": "",
            "is_flat": False,
        }

    if gap >= 20:
        confidence = "High"
        message = f"Based on your interest profile, {stream} is a strong match. Your interests clearly align with this direction."
    elif gap >= 10:
        confidence = "Moderate"
        message = f"Based on your interests, {stream} appears to be a good fit. Consider exploring this stream while keeping other options open."
    else:
        confidence = "Low"
        message = f"Your interests suggest {stream} may be worth exploring, but your profile shows broad interests. We recommend discussing with a counsellor before deciding."

    return {
        "stream": stream,
        "confidence": confidence,
        "message": message,
        "message_hi": "",
        "is_flat": False,
    }


# ── Endpoints ──────────────────────────────────────────────────

@router.get("/questions")
def get_quiz_questions():
    """Return the 15 quiz questions (public, no auth)."""
    return {"questions": QUIZ_QUESTIONS, "total": len(QUIZ_QUESTIONS)}


@router.post("/submit")
def submit_quiz(submission: QuizSubmission):
    """Process quiz answers and return stream recommendation (public, no auth)."""
    # Calculate RIASEC scores from 15 questions
    type_scores = {"R": 0, "I": 0, "A": 0, "S": 0, "E": 0, "C": 0}
    type_counts = {"R": 0, "I": 0, "A": 0, "S": 0, "E": 0, "C": 0}

    for q in QUIZ_QUESTIONS:
        qid = str(q["id"])
        if qid in submission.answers:
            score = max(1, min(5, submission.answers[qid]))
            type_scores[q["type"]] += score
            type_counts[q["type"]] += 1

    # Normalize to percentages
    riasec_pct = {}
    for t in "RIASEC":
        count = type_counts[t]
        if count > 0:
            riasec_pct[t] = round((type_scores[t] / (count * 5)) * 100, 1)
        else:
            riasec_pct[t] = 0

    # Determine top 3 types (Holland code)
    sorted_types = sorted(riasec_pct.items(), key=lambda x: -x[1])
    holland_code = "".join(t for t, _ in sorted_types[:3])

    # Stream recommendation with flat/straight-line detection
    rec = calculate_recommendation(riasec_pct, submission.answers)

    # Save Lead record
    lead_id = None
    try:
        db = SessionLocal()
        lead = Lead(
            name=submission.student_name,
            phone=submission.parent_phone,
            email=submission.email,
            class_level=submission.class_level,
            holland_code=holland_code,
            recommended_stream=rec["stream"] or "Undetermined",
            riasec_scores=riasec_pct,
            source="free_quiz",
            utm_source=submission.utm_source,
            utm_medium=submission.utm_medium,
            utm_campaign=submission.utm_campaign,
        )
        db.add(lead)
        db.commit()
        db.refresh(lead)
        lead_id = lead.id
        db.close()
    except Exception as e:
        logger.warning(f"Failed to save quiz lead: {e}")

    return {
        "holland_code": holland_code,
        "riasec_scores": riasec_pct,
        "recommended_stream": rec["stream"],
        "confidence": rec["confidence"],
        "primary_type": sorted_types[0][0] if sorted_types else "",
        "lead_id": lead_id,
        "message": rec["message"],
        "message_hi": rec.get("message_hi", ""),
        "is_flat": rec["is_flat"],
        "cta": "Get Your Full Career Report \u2014 \u20b9500 only",
        "cta_url": "https://www.careerneeti.in",
    }
