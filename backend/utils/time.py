"""Single source of truth for "now".

Every timestamp in this codebase is a timezone-aware UTC instant, and every
``DateTime`` column is declared ``timezone=True`` (TIMESTAMPTZ on Postgres).

Before this module existed, three different spellings were in use — naive
``datetime.utcnow()``, aware ``datetime.now(timezone.utc)``, and local-time
``datetime.now()`` — sometimes writing the *same* column. SQLite hid the
inconsistency by stripping offsets on write; Postgres does not, and mixing them
either shifts values by the server's timezone offset or raises
``TypeError: can't subtract offset-naive and offset-aware`` on read.

Import ``utcnow`` from here and never call the stdlib spellings directly, so
there is exactly one symbol to audit. (``datetime.utcnow()`` is also deprecated
from Python 3.12, which this project targets.)
"""

from datetime import datetime, timezone

__all__ = ["utcnow"]


def utcnow() -> datetime:
    """Current time as a timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)
