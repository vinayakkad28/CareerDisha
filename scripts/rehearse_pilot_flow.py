"""Rehearse the pilot flow in a real browser, the way a student will use it.

Run this before a school visit. It is a manual check, not part of the test
suite: it needs both servers up and a browser.

    pip install playwright && python -m playwright install chromium

    # terminal 1
    cd backend && DATABASE_URL=sqlite:///rehearsal.db python -m alembic upgrade head
    DATABASE_URL=sqlite:///rehearsal.db ADMIN_PASSWORD=x JWT_SECRET=y \
        python -m uvicorn main:app --port 8000
    # terminal 2 — ALLOW_LOCAL_API lets the CSP reach a local backend
    cd frontend && ALLOW_LOCAL_API=1 pnpm build && ALLOW_LOCAL_API=1 PORT=3099 pnpm start
    # terminal 3 — mint codes into /tmp/codes.txt, then
    python scripts/rehearse_pilot_flow.py

What it proves: a student can enter a school code and finish all 110 items on a
phone-sized screen without a console error or a failed request, and that tapping
an answer twice — the ordinary gesture when the screen has not moved yet —
advances exactly one question rather than silently skipping one.
"""
import re, sys
from playwright.sync_api import sync_playwright

CODES = [c for c in open("/tmp/codes.txt").read().split() if c]
NAV = re.compile(r"^(Next|Previous|Continue|Submit Aptitude|Submit|Finish|Skip.*|Start.*)$", re.I)
ok = []

def step(label, good, extra=""):
    print(f"{'PASS' if good else 'FAIL'}  {label} {extra}")
    ok.append(good)

def tipi_counter(page):
    m = re.search(r"About You\s*—\s*(\d+) of (\d+)", page.inner_text("body"))
    return (int(m.group(1)), int(m.group(2))) if m else None

def begin(page, code, name):
    page.goto("http://localhost:3099/assessment", wait_until="networkidle")
    page.fill("input >> nth=0", name)
    page.fill("input >> nth=1", code)
    b = page.get_by_role("button", name=re.compile("^10$"))
    if b.count(): b.first.click()
    page.get_by_role("button", name=re.compile("Start Assessment", re.I)).click()
    page.wait_for_timeout(2000)

def answer_screen(page):
    """Answer everything visible, then advance. Returns False if nothing to do."""
    acted = False
    opts = page.locator("button:visible")
    for i in range(opts.count()):
        el = opts.nth(i)
        try:
            t = (el.inner_text() or "").strip()
            if t and not NAV.fullmatch(t) and el.is_enabled():
                el.click(timeout=1200); acted = True
        except Exception:
            pass
    ins = page.locator("input:visible")
    for i in range(ins.count()):
        el = ins.nth(i)
        try:
            if (el.input_value() or "") == "":
                el.fill("75"); acted = True
        except Exception:
            pass
    for nm in ("Continue", "Next", "Submit Aptitude", "Finish", "Submit",
               "Skip to next section", "Skip to Interest Assessment"):
        try:
            b = page.get_by_role("button", name=re.compile(rf"^{nm}$", re.I))
            if b.count() and b.first.is_enabled():
                b.first.click(timeout=1500); acted = True; break
        except Exception:
            pass
    return acted

with sync_playwright() as p:
    br = p.chromium.launch()

    # ── run 1: the double-tap gesture ────────────────────────────────────────
    page = br.new_page(viewport={"width": 420, "height": 900})
    begin(page, CODES[0], "Tap Twice")
    for _ in range(60):
        if tipi_counter(page): break
        if not answer_screen(page): break
        page.wait_for_timeout(220)
    before = tipi_counter(page)
    if not before:
        step("reached the personality section", False, "never got there")
    else:
        opt = page.locator("button:visible").filter(has_text=re.compile("Agree")).first
        opt.click(); page.wait_for_timeout(60)
        try: opt.click(timeout=800)
        except Exception:
            page.locator("button:visible").filter(has_text=re.compile("Agree")).first.click()
        page.wait_for_timeout(1200)
        after = tipi_counter(page)
        step("a double-tap advances exactly one question",
             after and after[0] - before[0] == 1, f"{before[0]} -> {after[0] if after else '?'}")
    page.close()

    # ── run 2: a clean walk all the way to the end ───────────────────────────
    page = br.new_page(viewport={"width": 420, "height": 900})
    errors, bad = [], []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("response", lambda r: bad.append(f"{r.status} {r.request.method} {r.url}")
            if r.url.startswith("http://localhost:8000") and r.status >= 400 else None)
    begin(page, CODES[1], "Riya Sharma")
    seen, done = [], False
    for i in range(150):
        try:
            head = page.inner_text("header").strip().replace("\n", " ")
        except Exception:
            head = ""
        if head and (not seen or seen[-1] != head):
            seen.append(head); print(f"     {head[:70]}")
        body = page.inner_text("body")
        if re.search(r"answers are in|thank you|all done|received", body, re.I):
            done = True; break
        if not answer_screen(page):
            print(f"     STUCK:\n{body[:300]}")
            break
        page.wait_for_timeout(180)
    step("a student can finish the whole assessment", done, f"{len(seen)} screens")
    step("no console errors", not [e for e in errors if "favicon" not in e.lower()],
         str(errors[:2]))
    step("no failed API calls", not bad, str(bad[:3]))
    page.screenshot(path="/tmp/assessment_done.png", full_page=True)
    br.close()

print(f"\n{sum(ok)}/{len(ok)} browser checks passed")
sys.exit(0 if all(ok) else 1)
