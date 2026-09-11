#!/usr/bin/env python3
"""Check that a deployed backend is the code you think it is. Read-only.

    python scripts/check_deployment.py                       # production
    python scripts/check_deployment.py http://localhost:8000

Why this exists: on 2026-09-10 careerneeti.in was serving a frontend built from
the pilot branch while the Render backend was still running main. The student
assessment was dead — /api/d2c/redeem did not exist, so every valid school code
came back "We do not recognise that code" — and nothing reached a roster, so
there was nothing to generate or download. Both halves looked healthy on their
own. This finds that in one command.

It NEVER writes. Every probe is a GET, or a POST with a deliberately invalid
token that cannot create a row, so it is safe to point at production. Route
presence is inferred from the shape of the refusal: an authenticated route
answers 401 when it exists and 404 when it does not; a token route answers
"Assessment not found" (the handler ran) versus "Not Found" (no such route).
"""

import json
import sys
import urllib.error
import urllib.request

DEFAULT_BASE = "https://careerdisha.onrender.com"
TIMEOUT = 90  # a free-plan instance takes ~50s to wake


def call(method: str, url: str, body: dict | None = None) -> tuple[int, str]:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.status, r.read().decode()[:400]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:400]
    except Exception as e:  # DNS, TLS, timeout
        return 0, str(e)[:200]


# Routes this frontend needs. "exists" is how the deployed app answers when the
# route is present; anything else means the backend predates the frontend.
PROBES = [
    # (label, method, path, body, exists_when)
    ("school code redemption", "POST", "/api/d2c/redeem/notarealtoken",
     {"code": "ABCD2345"}, lambda c, b: "Assessment not found" in b),
    ("access codes listing", "GET", "/api/sessions/1/access-codes",
     None, lambda c, b: c in (401, 403)),
    ("offline fee record", "PUT", "/api/students/1/fee",
     {"fee_paid": False}, lambda c, b: c in (401, 403)),
    ("per-student PDF", "GET", "/api/students/1/pdf",
     None, lambda c, b: c in (401, 403)),
    ("session ZIP", "GET", "/api/sessions/1/download",
     None, lambda c, b: c in (401, 403)),
    ("assessment questions", "GET", "/api/d2c/questions",
     None, lambda c, b: c == 200),
]

# Routes the pilot deliberately removed. Still present means old code is live.
SHOULD_BE_GONE = [
    ("online report", "GET", "/api/d2c/report/notarealtoken"),
    ("online report PDF", "GET", "/api/d2c/pdf/notarealtoken"),
    ("public report page", "GET", "/api/reports/notarealtoken"),
]


def main() -> int:
    base = (sys.argv[1] if len(sys.argv) > 1 else DEFAULT_BASE).rstrip("/")
    print(f"Checking {base}\n")
    problems: list[str] = []

    status, body = call("GET", f"{base}/api/health")
    if status == 0:
        print(f"FAIL  unreachable: {body}")
        return 1
    try:
        health = json.loads(body)
    except ValueError:
        print(f"FAIL  /api/health did not return JSON: {body[:120]}")
        return 1

    print(f"  status              {health.get('status')}")
    print(f"  database            {health.get('db')}")
    print(f"  llm provider        {health.get('llm_provider')}")
    print(f"  llm model           {health.get('llm_model') or 'unknown'}")
    print(f"  llm key configured  {health.get('llm_key_configured')}")

    if health.get("db") != "connected":
        problems.append("the database is not reachable from the API")
    if not health.get("llm_key_configured"):
        problems.append(
            f"no API key for provider {health.get('llm_provider')!r} — "
            "report generation will fail for every student"
        )
    model = (health.get("llm_model") or "").lower()
    if "8b" in model:
        # fix_groq.py scores any 8B model 0 — "too small for this schema". It
        # does not error; it returns truncated JSON that QA hard-flags, so every
        # report "generates" and none is ever deliverable.
        problems.append(
            f"the configured model {model} is too small for the report schema — "
            "reports will generate and then fail QA"
        )
    if "payments_enabled" in health:
        problems.append(
            "/api/health reports payments_enabled, a field the pilot removed: "
            "this backend is running code older than the current frontend"
        )

    print("\nRoutes the frontend depends on:")
    for label, method, path, payload, exists in PROBES:
        code, resp = call(method, f"{base}{path}", payload)
        ok = exists(code, resp)
        print(f"  {'ok  ' if ok else 'MISS'}  {label:26} {method} {path} -> {code}")
        if not ok:
            problems.append(f"{label} is missing ({method} {path} answered {code})")

    print("\nRoutes the pilot removed:")
    for label, method, path in SHOULD_BE_GONE:
        code, resp = call(method, f"{base}{path}")
        gone = code == 404 and "Not Found" in resp and "Assessment" not in resp
        print(f"  {'ok  ' if gone else 'OLD '}  {label:26} {method} {path} -> {code}")
        if not gone:
            problems.append(f"{label} is still served — old code is deployed")

    print()
    if problems:
        print(f"{len(problems)} problem(s):")
        for p in problems:
            print(f"  - {p}")
        return 1
    print("Deployment matches the current frontend.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
