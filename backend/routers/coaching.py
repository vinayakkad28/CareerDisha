"""Coaching partner referral endpoints."""
import json
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException

from config import DATA_DIR

logger = logging.getLogger(__name__)
router = APIRouter()

_partners_cache = None

def _public_partner(p: dict) -> dict:
    """Strip commercial fields that are not yet real.

    Every partner in the data file ships with referral_code="" because no
    referral agreement has been signed. Returning an empty code invited the UI
    to render a broken referral link and to imply a partnership that does not
    exist, so the fields are omitted entirely until a code is present.
    """
    out = {k: v for k, v in p.items() if k not in ("referral_code", "referral_fee_inr")}
    code = (p.get("referral_code") or "").strip()
    out["has_referral"] = bool(code)
    if code:
        out["referral_code"] = code
        out["referral_fee_inr"] = p.get("referral_fee_inr")
    return out


def _load_partners():
    global _partners_cache
    if _partners_cache is None:
        path = DATA_DIR / "coaching_partners.json"
        if path.exists():
            with open(path) as f:
                _partners_cache = json.load(f)
        else:
            _partners_cache = {"partners": [], "exam_to_partners": {}}
    return _partners_cache


@router.get("/partners")
def list_partners():
    """List all coaching partners."""
    data = _load_partners()
    return {
        "partners": [_public_partner(p) for p in data["partners"]],
        "total": len(data["partners"]),
        "exams": sorted(data["exam_to_partners"].keys()),
    }


@router.get("/recommend/{exam}")
def recommend_for_exam(exam: str, budget: str = ""):
    """Recommend coaching partners for a specific entrance exam."""
    data = _load_partners()
    partner_ids = data["exam_to_partners"].get(exam, [])
    if not partner_ids:
        # Try fuzzy match
        for key, ids in data["exam_to_partners"].items():
            if exam.lower() in key.lower():
                partner_ids = ids
                break

    partners = [p for p in data["partners"] if p["id"] in partner_ids]

    # Filter by budget if provided
    if budget == "low":
        partners = [p for p in partners if p["type"] == "online"]
    elif budget == "high":
        partners = [p for p in partners if p["type"] in ("physical", "hybrid")]

    return {
        "exam": exam,
        "partners": [_public_partner(p) for p in partners],
        "total": len(partners),
        "note": "Coaching is optional for many exams. Self-study with free resources (NPTEL, SWAYAM, YouTube) is a valid path."
    }


@router.get("/compare")
def compare_options(exam: str = "JEE Main"):
    """Compare coaching vs self-study for an exam."""
    data = _load_partners()
    partner_ids = data["exam_to_partners"].get(exam, [])
    partners = [p for p in data["partners"] if p["id"] in partner_ids]

    online = [p for p in partners if p["type"] == "online"]
    physical = [p for p in partners if p["type"] == "physical"]

    return {
        "exam": exam,
        "options": {
            "self_study": {
                "cost": "₹0 - ₹5,000",
                "pros": ["Free/very cheap", "Flexible schedule", "Self-paced learning"],
                "cons": ["Requires strong self-discipline", "No structured guidance", "Harder to clear doubts"],
                "best_for": "Self-motivated students with strong fundamentals",
                "resources": ["NPTEL (free)", "SWAYAM (free)", "Khan Academy", "YouTube (Physics Wallah free lectures)"]
            },
            "online_coaching": {
                "cost": f"₹{min(float(p['fee_range_lakh'].split('-')[0]) for p in online) if online else 0.02}L - ₹{max(float(p['fee_range_lakh'].split('-')[1]) for p in online) if online else 0.50}L",
                "pros": ["Affordable", "Learn from home", "Recorded lectures for revision"],
                "cons": ["Less personal attention", "Requires internet", "Self-discipline still needed"],
                "partners": [{"name": p["name"], "fee": p["fee_range_lakh"]} for p in online[:3]],
            },
            "physical_coaching": {
                "cost": f"₹{min(float(p['fee_range_lakh'].split('-')[0]) for p in physical) if physical else 1.5}L - ₹{max(float(p['fee_range_lakh'].split('-')[1]) for p in physical) if physical else 6.0}L",
                "pros": ["Structured environment", "Personal attention", "Peer competition"],
                "cons": ["Expensive", "May require relocation", "Fixed schedule"],
                "partners": [{"name": p["name"], "fee": p["fee_range_lakh"]} for p in physical[:3]],
            }
        },
        "honest_advice": "Coaching is NOT mandatory for success. Many JEE/NEET toppers are self-study students. Choose based on your learning style, financial situation, and self-discipline level."
    }
