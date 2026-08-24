"""Canonical self-efficacy domain keys.

Three layers disagreed on how to name the same six subjects:

  * ``GET /api/d2c/questions`` offers item ids ``se_maths``, ``se_science``, ...
  * the assessment UI sends display labels ``"Mathematics"``, ``"Creative Arts"``,
    ``"Business / Commerce"``, ...
  * the school CSV importer produces ``maths``, ``science``, ``arts``, ...

Consumers looked up the lowercase form. ``stream_recommender`` had a ``.title()``
fallback, so exactly one of six domains ("Science") matched by luck;
``report_generator`` had no fallback at all, so the interest-versus-confidence
warning was missing from the LLM prompt for **every** D2C report — an advertised,
paid-for feature that had never once fired.

Normalising once at ingestion means the consumers can do a plain lookup, and a
future fourth spelling only has to be handled here.
"""

import re

__all__ = ["CANONICAL_DOMAINS", "normalize_self_efficacy"]

CANONICAL_DOMAINS = ("maths", "science", "english", "arts", "business", "social")

# Keys are the incoming spelling reduced to lowercase letters only.
_SYNONYMS = {
    "maths": "maths", "math": "maths", "mathematics": "maths", "semaths": "maths",
    "science": "science", "sescience": "science",
    "english": "english", "seenglish": "english",
    "arts": "arts", "art": "arts", "creativearts": "arts", "searts": "arts",
    "business": "business", "commerce": "business",
    "businesscommerce": "business", "sebusiness": "business",
    "social": "social", "socialservice": "social",
    "socialstudies": "social", "sesocial": "social",
}


def _canonical_key(raw: str) -> str | None:
    return _SYNONYMS.get(re.sub(r"[^a-z]", "", str(raw).lower()))


def normalize_self_efficacy(raw: dict | None) -> dict | None:
    """Map any accepted domain spelling to the canonical keys, dropping unknowns.

    Values are coerced to int where possible; entries that are neither a known
    domain nor a numeric score are omitted rather than silently stored under a
    key nothing will ever read.
    """
    if not raw or not isinstance(raw, dict):
        return None

    out: dict[str, int] = {}
    for key, value in raw.items():
        domain = _canonical_key(key)
        if domain is None:
            continue
        try:
            out[domain] = int(value)
        except (TypeError, ValueError):
            continue
    return out or None
