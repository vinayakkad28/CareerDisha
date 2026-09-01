#!/usr/bin/env python3
"""Find a Groq model that actually works with this app's call shape.

The app does not make a generic chat call. engines/report_generator._call_groq
asks for max_tokens=12000 AND response_format={"type":"json_object"}, so a model
is only usable here if it supports JSON mode and allows a 12k completion. A model
that chats fine can still 400 on those arguments, which is why this probes with
the app's real parameters rather than a hello-world.

Run:  python3 fix_groq.py
"""
import getpass
import json
import sys
import urllib.error
import urllib.request

BASE = "https://api.groq.com/openai/v1"
APP_MAX_TOKENS = 12000  # must match _call_groq


def api(path, key, body=None, timeout=90):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode() if body else None,
        headers={"Authorization": f"Bearer {key}",
                 "Content-Type": "application/json"},
        method="POST" if body else "GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {}
    except Exception as e:
        return 0, {"error": {"message": f"{type(e).__name__}: {e}"}}


key = getpass.getpass("Groq API key (starts gsk_, hidden): ").strip()
if not key:
    sys.exit("No key entered.")

print("\n[1/3] Checking the key…")
status, data = api("/models", key)
if status in (401, 403):
    # 401 = recognised but revoked/expired; 403 = malformed or wrong project.
    # Both mean the same thing for the operator, so don't make them guess.
    detail = (data.get("error") or {}).get("message", "")
    sys.exit(f"  Key is INVALID ({status}{': ' + detail if detail else ''}).\n"
             "  Create a fresh one at https://console.groq.com/keys and re-run.")
if status != 200:
    sys.exit(f"  Unexpected {status}: {json.dumps(data)[:300]}")
print("  Key is valid.")

models = [m for m in data.get("data", []) if m.get("active", True)]
chat = sorted(
    (m for m in models if "whisper" not in m["id"] and "tts" not in m["id"]
     and "guard" not in m["id"] and "prompt-guard" not in m["id"]),
    key=lambda m: -(m.get("context_window") or 0),
)
print(f"\n[2/3] {len(chat)} chat model(s) reachable:")
for m in chat:
    print(f"    {m['id']:<44} ctx={m.get('context_window','?'):>7} "
          f"max_out={m.get('max_completion_tokens','?')}")

print(f"\n[3/3] Probing each with the app's real arguments "
      f"(json_object + max_tokens={APP_MAX_TOKENS})…")
working = []
for m in chat:
    mid = m["id"]
    st, resp = api("/chat/completions", key, {
        "model": mid,
        "messages": [
            {"role": "system", "content": "Reply with JSON only."},
            {"role": "user", "content": 'Return {"ok": true} and nothing else.'},
        ],
        "max_tokens": APP_MAX_TOKENS,
        "response_format": {"type": "json_object"},
    })
    if st == 200:
        try:
            json.loads(resp["choices"][0]["message"]["content"])
            working.append((mid, m.get("context_window") or 0))
            print(f"    OK    {mid}")
            continue
        except Exception:
            print(f"    BAD   {mid}  — returned non-JSON in JSON mode")
            continue
    msg = (resp.get("error") or {}).get("message", "")[:95]
    print(f"    {st:<5} {mid}  — {msg}")

if not working:
    print("\nNothing worked with max_tokens=12000. Retrying the best model lower…")
    for cap in (8192, 4096):
        for m in chat[:4]:
            st, resp = api("/chat/completions", key, {
                "model": m["id"],
                "messages": [{"role": "user", "content": 'Return {"ok":true}'}],
                "max_tokens": cap,
                "response_format": {"type": "json_object"},
            })
            if st == 200:
                print(f"    {m['id']} works at max_tokens={cap} but not 12000.")
                print(f"    -> lower max_tokens in _call_groq to {cap}, or pick a "
                      f"model with a larger completion limit.")
                sys.exit(0)
    sys.exit("\nNo working combination found. Check your Groq account tier.")

# Rank for THIS task, not by context size. The report prompt asks for a long,
# deeply nested JSON document (a 300-word portrait, a 7-stage journey map, all
# five streams compared). Small models parrot the schema but fill it thinly or
# truncate mid-object, which surfaces later as a QA failure rather than an API
# error. Prefer bigger/stronger families; fall back to context window.
def rank(mid: str) -> int:
    m = mid.lower()
    if "120b" in m or "maverick" in m: return 5
    if "70b" in m or "kimi-k2" in m:   return 4
    if "32b" in m or "scout" in m:     return 3
    if "20b" in m:                     return 2
    if "8b" in m:                      return 0          # too small for this schema
    return 1

working.sort(key=lambda w: (-rank(w[0]), -w[1]))
best = working[0][0]
if rank(best) <= 0:
    print("\n  NOTE: only small models are available to this key. They tend to "
          "truncate\n        this app's report JSON — expect QA failures rather "
          "than clean errors.")
print(f"""
{'=' * 66}
WORKS: {', '.join(w[0] for w in working)}

Set these two in the Render dashboard (Environment tab), then Save:

    GROQ_MODEL     {best}
    GROQ_API_KEY   the key you just entered

Render restarts the service on save. No redeploy or code change is needed —
the model id is read from the environment at import.
{'=' * 66}""")
