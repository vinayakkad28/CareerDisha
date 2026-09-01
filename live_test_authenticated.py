#!/usr/bin/env python3
"""
Authenticated live-site test pass — sections C (staff pipeline) and D (tenancy).

Run:  python3 live_test_authenticated.py

Prompts for your admin password (hidden). Creates records prefixed ZZTEST- so
they are easy to identify later. Calls NO destructive endpoint: the DPDPA
erasure route and commission mark-paid are never touched, and school
deactivation is used only on a school this script created.
"""
import getpass, json, sys, time, urllib.error, urllib.request

BASE = "https://careerdisha.onrender.com"
R = []


def call(method, path, *, token=None, body=None, expect=None, note="", timeout=180,
         files=None):
    url = BASE + path
    headers = {}
    data = None
    if files:
        boundary = "----ZZTESTBOUNDARY"
        parts = []
        for field, (fname, content) in files.items():
            parts.append(f"--{boundary}\r\nContent-Disposition: form-data; "
                         f'name="{field}"; filename="{fname}"\r\n'
                         f"Content-Type: text/csv\r\n\r\n".encode() + content + b"\r\n")
        parts.append(f"--{boundary}--\r\n".encode())
        data = b"".join(parts)
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    elif body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            status, payload = r.status, _dec(r.read())
    except urllib.error.HTTPError as e:
        status, payload = e.code, _dec(e.read())
    except Exception as e:
        status, payload = 0, f"{type(e).__name__}: {e}"
    ok = (status == expect) if expect is not None else None
    R.append({"m": method, "p": path, "s": status, "e": expect, "ok": ok, "n": note})
    mark = "ok " if ok else ("FAIL" if ok is False else " ? ")
    exp = f" (expected {expect})" if ok is False else ""
    print(f"  [{mark}] {method:6} {path[:50]:50} -> {status}{exp}  {note}")
    return status, payload


def _dec(b):
    try:
        return json.loads(b.decode())
    except Exception:
        return b.decode()[:300] if isinstance(b, bytes) else b


print("Live authenticated test pass. Warming the instance (may take ~60s)…")
for _ in range(8):
    s, p = call("GET", "/api/health", note="warm")
    R.pop()
    if s == 200 and isinstance(p, dict) and p.get("db") == "connected":
        break
else:
    print("Could not reach a healthy backend. Aborting."); sys.exit(1)

pw = getpass.getpass("Admin password (hidden): ")
s, p = call("POST", "/api/auth/login", body={"password": pw}, expect=200, note="admin login")
if s != 200:
    print("Login failed — check ADMIN_PASSWORD in Render → Environment."); sys.exit(1)
T = p["token"]

# ── what already exists (you said real records exist) ─────────────────
print("\n=== existing production data (nothing written yet) ===")
s, stats = call("GET", "/api/dashboard/stats", token=T, expect=200, note="")
if isinstance(stats, dict):
    print("   ", json.dumps({k: v for k, v in stats.items() if isinstance(v, (int, float))}))
s, schools = call("GET", "/api/schools", token=T, expect=200, note="")
if isinstance(schools, list):
    print(f"    {len(schools)} school(s):", [x.get("code") for x in schools][:10])

# ── whatsapp must be unconfigured before any send endpoint ────────────
print("\n=== confirm WhatsApp is a no-op before touching send routes ===")
s, wa = call("GET", "/api/whatsapp/status", token=T, expect=200, note="")
configured = isinstance(wa, dict) and wa.get("configured")
print(f"    configured = {configured}")
if configured:
    print("    !! WhatsApp IS configured — skipping all send endpoints to avoid "
          "messaging real parents.")

# ── Section C: staff pipeline ─────────────────────────────────────────
print("\n=== SECTION C — staff pipeline ===")
s, sch = call("POST", "/api/schools", token=T, expect=201, note="create ZZTEST school A",
              body={"name": "ZZTEST-School A", "code": "ZZTEST-A", "city": "Noida",
                    "contact_person": "ZZTEST", "contact_phone": "9990000001"})
if s != 201:
    print("Could not create test school; aborting section C."); sys.exit(1)
SA = sch["id"]

s, ses = call("POST", "/api/sessions", token=T, expect=201, note="session (llm_provider=groq)",
              body={"school_id": SA, "session_date": "2026-09-01",
                    "classes_assessed": [9, 10], "counsellor_name": "ZZTEST",
                    "llm_provider": "groq", "notes": "ZZTEST automated pass"})
SID = ses.get("id") if isinstance(ses, dict) else None

# honest-status check BEFORE anything has been produced
print("\n  -- a stage that produces nothing must not advance status --")
call("POST", f"/api/sessions/{SID}/qa", token=T, expect=200, note="QA with 0 reports")
s, cur = call("GET", f"/api/sessions/{SID}", token=T, expect=200, note="")
st = cur.get("status") if isinstance(cur, dict) else "?"
print(f"    status after empty QA = {st!r}  (must NOT be 'qa_review')")
if st == "qa_review":
    print("    [FAIL] status advanced with zero reports — regression")

call("POST", f"/api/sessions/{SID}/pdf", token=T, expect=200, note="PDFs with 0 QA-passed")
time.sleep(6)
s, cur = call("GET", f"/api/sessions/{SID}", token=T, expect=200, note="")
st = cur.get("status") if isinstance(cur, dict) else "?"
print(f"    status after empty PDF = {st!r}  (must NOT be 'pdf_ready')")

print("\n  -- upload the repo's own fixtures --")
try:
    zg = open("backend/data/sample_zipgrade.csv", "rb").read()
    si = open("backend/data/sample_students.csv", "rb").read()
    call("POST", f"/api/sessions/{SID}/upload-csvs", token=T, expect=200, note="CSV upload",
         files={"zipgrade_csv": ("sample_zipgrade.csv", zg),
                "student_info_csv": ("sample_students.csv", si)})
except FileNotFoundError:
    print("    [SKIP] fixtures not found — run this from the repo root")

call("POST", f"/api/sessions/{SID}/score", token=T, expect=200, note="score students")
call("POST", f"/api/consent/sessions/{SID}/bulk-consent", token=T, expect=200, note="bulk consent")
s, cur = call("GET", f"/api/sessions/{SID}", token=T, expect=200, note="")
if isinstance(cur, dict):
    print("    stats:", json.dumps(cur.get("stats", {})))
    studs = cur.get("students", [])
    if studs:
        leaky = [k for k in ("riasec_raw_responses", "big_five_scores", "family_income",
                             "parental_education", "consent_parent_name", "pdf_path")
                 if k in studs[0]]
        print(f"    student row: {len(studs[0])} fields; PII leaked: {leaky or 'NONE'}")

print("\n  -- report generation (rate limited 2 per 5 min) --")
call("POST", f"/api/sessions/{SID}/generate", token=T, expect=200, note="generate (groq)")
print("    waiting 75s for the background job…")
time.sleep(75)
s, cur = call("GET", f"/api/sessions/{SID}", token=T, expect=200, note="")
if isinstance(cur, dict):
    print("    stats:", json.dumps(cur.get("stats", {})), " status:", cur.get("status"))
    if cur.get("stats", {}).get("reports_generated", 0) == 0:
        print("    [!] no reports generated — check Render logs for the LLM error "
              "(GROQ_MODEL may still be unset)")

call("POST", f"/api/sessions/{SID}/qa", token=T, expect=200, note="run QA")
call("POST", f"/api/sessions/{SID}/pdf", token=T, expect=200, note="generate PDFs")
time.sleep(25)
s, cur = call("GET", f"/api/sessions/{SID}", token=T, expect=200, note="")
if isinstance(cur, dict):
    print("    final stats:", json.dumps(cur.get("stats", {})), " status:", cur.get("status"))

if isinstance(cur, dict) and cur.get("students"):
    stu = cur["students"][0]["id"]
    s, sd = call("GET", f"/api/students/{stu}", token=T, expect=200, note="student detail")
    if isinstance(sd, dict):
        leaky = [k for k in ("riasec_raw_responses", "family_income", "parental_education",
                             "consent_parent_name", "pdf_path", "report_token")
                 if k in sd]
        print(f"    student detail: {len(sd)} fields; sensitive keys present: {leaky or 'NONE'}")
    call("GET", f"/api/students/{stu}/card", token=T, note="student card")
    call("GET", f"/api/outcomes/student/{stu}", token=T, expect=200, note="student outcomes")

call("GET", f"/api/sessions/{SID}/download", token=T, note="download ZIP")
call("GET", f"/api/sessions/{SID}/compliance-certificate", token=T, expect=200, note="CBSE cert JSON")
call("GET", f"/api/sessions/{SID}/compliance-certificate/pdf", token=T, expect=200, note="CBSE cert PDF")
call("GET", f"/api/sessions/{SID}/parent-circular/pdf?fee=500", token=T, expect=200, note="parent circular")
call("GET", f"/api/sessions/{SID}/school-summary", token=T, expect=200, note="school summary")
call("GET", f"/api/reports/sessions/{SID}/qa-report", token=T, expect=200, note="QA report")
call("GET", f"/api/reports/sessions/{SID}/delivery-checklist", token=T, expect=200, note="delivery checklist")
call("GET", f"/api/consent/sessions/{SID}/consent-status", token=T, expect=200, note="consent status")
call("GET", f"/api/outcomes/session/{SID}", token=T, expect=200, note="session outcomes")
call("GET", f"/api/nps/session/{SID}", token=T, expect=200, note="session NPS")
call("GET", f"/api/feedback/session/{SID}/summary", token=T, expect=200, note="feedback summary")
call("POST", f"/api/counsellors/commissions/{SID}/calculate", token=T, expect=201,
     note="calculate commission (our session)")
call("GET", "/api/counsellors/commissions", token=T, expect=200, note="commission list")
call("GET", "/api/counsellors/assignments", token=T, expect=200, note="assignment list")
call("GET", "/api/counsellors/list", token=T, expect=200, note="counsellor list")
call("GET", "/api/auth/me", token=T, expect=200, note="whoami")
call("GET", "/api/dashboard/recent", token=T, expect=200, note="recent activity")
call("GET", "/api/dashboard/aggregate", token=T, expect=200, note="admin-only aggregate")
call("GET", "/api/dashboard/cost-summary", token=T, expect=200, note="cost summary")
call("GET", "/api/audit/logs?limit=5", token=T, expect=200, note="audit trail")

# ── Section D: tenancy ────────────────────────────────────────────────
print("\n=== SECTION D — tenancy (the PR #3 fix) ===")
s, schB = call("POST", "/api/schools", token=T, expect=201, note="create ZZTEST school B",
               body={"name": "ZZTEST-School B", "code": "ZZTEST-B", "city": "Delhi"})
SB = schB.get("id") if isinstance(schB, dict) else None

s, usr = call("POST", "/api/auth/register", token=T, expect=200, note="create ZZTEST counsellor",
              body={"email": "zztest.counsellor@example.com", "name": "ZZTEST Counsellor",
                    "password": "ZZtest-passw0rd-123", "role": "counsellor"})
if s not in (200, 201):
    s, usr = call("POST", "/api/auth/register", token=T, note="retry (may already exist)",
                  body={"email": "zztest.counsellor@example.com", "name": "ZZTEST Counsellor",
                        "password": "ZZtest-passw0rd-123", "role": "counsellor"})
s, users = call("GET", "/api/auth/users", token=T, expect=200, note="")
cid = next((u["id"] for u in users if u.get("email") == "zztest.counsellor@example.com"),
           None) if isinstance(users, list) else None

if cid:
    call("POST", "/api/counsellors/assignments", token=T, expect=201, note="assign to School A only",
         body={"counsellor_id": cid, "school_id": SA})
    s, lg = call("POST", "/api/auth/login", expect=200, note="counsellor login",
                 body={"email": "zztest.counsellor@example.com", "password": "ZZtest-passw0rd-123"})
    CT = lg.get("token") if isinstance(lg, dict) else None
    if CT:
        print("\n  -- counsellor must see School A only --")
        s, cs = call("GET", "/api/schools", token=CT, expect=200, note="")
        print(f"    sees: {[x.get('code') for x in cs] if isinstance(cs, list) else cs}")
        if isinstance(cs, list) and any(x.get("code") == "ZZTEST-B" for x in cs):
            print("    [FAIL] counsellor can see School B — tenancy hole")
        call("GET", f"/api/schools/{SB}", token=CT, expect=404, note="School B detail")
        call("PUT", f"/api/schools/{SB}", token=CT, expect=403, note="edit School B",
             body={"contact_phone": "6666666666"})
        call("PUT", f"/api/schools/{SA}", token=CT, expect=403, note="edit own school (admin-only)")
        call("POST", "/api/schools", token=CT, expect=403, note="create a school",
             body={"name": "ZZTEST-Rogue", "code": "ZZTEST-R", "city": "X"})
        call("DELETE", f"/api/schools/{SB}", token=CT, expect=403, note="delete School B")
        call("GET", "/api/dashboard/aggregate", token=CT, expect=403, note="admin-only aggregate")
        call("GET", "/api/counsellors/list", token=CT, expect=403, note="admin-only counsellor list")
        call("GET", "/api/counsellors/my-schools", token=CT, expect=200, note="own schools (allowed)")
        call("GET", "/api/counsellors/my-commissions", token=CT, expect=200, note="own commissions")

# ── soft delete, on our own school only ───────────────────────────────
print("\n=== soft delete (only on ZZTEST-B, which this script created) ===")
call("DELETE", f"/api/schools/{SB}", token=T, expect=200, note="deactivate School B")
call("GET", f"/api/schools/{SB}", token=T, expect=404, note="hidden after deactivation")

# ── summary ───────────────────────────────────────────────────────────
fails = [r for r in R if r["ok"] is False]
print("\n" + "=" * 70)
print(f"{len(R)} calls, {len(fails)} unexpected")
for f in fails:
    print(f"  FAIL {f['m']} {f['p']} -> {f['s']} (expected {f['e']})  {f['n']}")
print(f"\nTest records created (prefix ZZTEST-): school {SA}, school {SB}, "
      f"session {SID}, counsellor {cid}")
print("These plus any Leads/D2C rows have no delete API — remove via SQL if wanted.")
json.dump(R, open("live_test_results.json", "w"), indent=1)
print("Full results written to live_test_results.json")
