# Deploying CareerNeeti

The previous backend was a Railway app that no longer exists; the Vercel
frontend is still live and still points at it. These steps stand up a new
backend on Render and repoint the frontend at it.

Everything below has been verified locally against PostgreSQL 15.

---

## 1. Database → Neon (do this first)

The database is deliberately **not** hosted on Render. Render's free Postgres is
**deleted 30 days after creation** — a data-loss event, not a downgrade — and
this project has already lost its database once.

1. Sign up at https://neon.com and create a project (region: choose the one
   closest to your users, e.g. `ap-southeast-1` Singapore for India).
2. Copy the **pooled** connection string from the dashboard. It looks like:
   `postgresql://user:pass@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
3. Keep `?sslmode=require` — Neon requires TLS, and psycopg2 (which this app
   uses) will refuse the connection without it.

Free tier: 0.5 GB storage, 100 compute-hours/month, and per Neon's own docs
"None of these limits delete your data." The compute suspends after 5 minutes
idle and wakes on the next connection, which is transparent to the app.

> Supabase also has a free Postgres, but it **pauses a project after 7 days of
> inactivity** and needs a manual click in the dashboard to restore. For a
> business with a seasonal rhythm — school visits Aug–Feb, D2C Mar–Jul — a quiet
> week would silently take the site down until someone noticed. Neon's
> scale-to-zero is automatic; Supabase's pause is not.

---

## 2. Backend → Render (create the service MANUALLY)

**Do not use New → Blueprint.** Render requires a payment method on file for
Blueprint deploys even when every service in the file is free — the dialog reads
"Your Blueprint services require payment information on file." Creating the same
service by hand uses the ordinary free tier and does not ask for a card.

`render.yaml` is kept in the repo as documentation of the intended configuration
and for later use on a paid plan, but the steps below do not rely on it.

1. **https://dashboard.render.com** → **New +** → **Web Service**
2. Connect `vinayakkad28/CareerDisha`, branch **main**
3. Fill in:

   | Field | Value |
   |---|---|
   | Name | `careerneeti-api` |
   | Language / Runtime | **Docker** |
   | Root Directory | **leave blank** |
   | Dockerfile Path | `./backend/Dockerfile` |
   | Instance Type | **Free** |

   > **Leave Root Directory empty.** Render builds with the repository root as
   > the Docker context and setting Root Directory does not change that, so the
   > Dockerfile's `COPY` paths are written with a `backend/` prefix to match.
   > Two failure modes if you get this wrong:
   > `open Dockerfile: no such file or directory` (Dockerfile Path is resolved
   > from the repo root, so `./Dockerfile` is wrong), and
   > `"/requirements.txt": not found` (the context is the repo root, so an
   > unprefixed COPY cannot find files inside backend/).
   >
   > The `.dockerignore` at the repository root is the one Docker actually reads;
   > `backend/.dockerignore` is ignored, and its rules are restated there.

4. Expand **Advanced** and set **Health Check Path** to `/api/health`.

5. Add the environment variables. Because the service is created by hand, none of
   these come from `render.yaml` — including `JWT_SECRET`, which the Blueprint
   would have generated. Generate one yourself:

   ```bash
   python3 -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Neon pooled string from step 1 |
   | `GROQ_API_KEY` | your Groq API key |
   | `ADMIN_PASSWORD` | a strong password — this is your login |
   | `JWT_SECRET` | the generated value above |
   | `ENVIRONMENT` | `production` |
   | `DEFAULT_LLM_PROVIDER` | `groq` |
   | `ENABLE_PAYMENTS` | `false` |
   | `CORS_ORIGINS` | `https://careerneeti.in,https://www.careerneeti.in` |
   | `APP_BASE_URL` | `https://careerneeti.in` |
   | `OUTPUT_DIR` | `/tmp/output` |
   | `LLM_TIMEOUT_SECONDS` | `90` |
   | `GROQ_MODEL` | only if the default is unavailable to your account — see below |

   The first four are required; the app refuses to start in production without
   `ADMIN_PASSWORD` and `JWT_SECRET`, and report generation fails without
   `GROQ_API_KEY`.

   > **If report generation fails with 404 "The model `X` does not exist or you
   > do not have access to it"**, your key cannot reach that model — providers
   > gate larger models by account tier and retire others. Check
   > https://console.groq.com/docs/models for what your account can use and set
   > `GROQ_MODEL` accordingly. No code change or redeploy of the image is needed;
   > the model id is read from the environment.

6. **Create Web Service**. The first build takes several minutes — it compiles
   the WeasyPrint system libraries into the image.

## 3. Frontend → Vercel

The frontend's API host lives **only** in the Vercel dashboard — there is no
`vercel.json` in the repo, and this single stale value is what points the live
site at the deleted Railway app.

1. Vercel → project `frontend` → **Settings → Environment Variables**.
2. Set `NEXT_PUBLIC_API_URL` to your Render URL, e.g.
   `https://careerneeti-api.onrender.com/api`
   (with or without the trailing `/api` — the client normalises it).
3. Redeploy. The variable is compiled into the bundle at build time, so a
   redeploy is required; changing it alone does nothing.

Then set `CORS_ORIGINS` on Render to your real frontend origin
(`https://careerneeti.in,https://www.careerneeti.in`) and confirm a request from
the site itself succeeds — not just curl, which is not subject to CORS.

> Vercel preview deployments are **not** allowed by default. The previous CORS
> regex `https://.*\.vercel\.app` let *any* Vercel-hosted site make credentialed
> requests. To allow your own previews, set `CORS_ORIGIN_REGEX` on Render to a
> pattern anchored to your project, e.g. `https://frontend-[a-z0-9-]+\.vercel\.app`.

---

## 4. First login

There are no users in a fresh database. Log in with the shared password
(`ADMIN_PASSWORD`, no email) to get an admin token, then create real accounts via
`POST /api/auth/register`. Prefer per-person accounts: they carry a real
`user_id`, so the audit trail attributes actions to a person, and they can be
scoped to a school.

---

## 5. Turning payments on

Payments are **off** by default and both payment endpoints return 503. This is
deliberate: with no credentials the old code silently issued a mock order that
verification auto-approved, so every paid report was obtainable for zero rupees.

When Razorpay is KYC-approved:

1. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
2. Set `ENABLE_PAYMENTS=true`.
3. Redeploy. The app refuses to start if the flag is on without credentials, so
   a half-configured payment path cannot reach production.
4. Verify with a real ₹1 test order that `/api/d2c/verify-payment` returns 400
   for a tampered signature and 200 only for a genuine one.

---

## 6. Things to know

- **The free Render web service sleeps after 15 minutes of inactivity**, so the
  first request after a quiet period takes roughly 30-60 seconds. That is
  tolerable for school sessions and the D2C funnel, but do not demo the site cold
  in front of a principal — hit it once beforehand to wake it.
- **Free instance hours are 750/month per workspace.** One service running
  continuously is about 730, so a second always-on free service would exceed it
  and Render suspends *all* free services until the next month.
- **Do not move the database onto Render's free Postgres.** It is deleted after
  30 days. See section 1.
- **Run a single worker.** The consent OTP store is process-local; with more than
  one worker, OTPs issued by one are invisible to the others and parent consent
  fails intermittently. The Dockerfile does not pass `--workers`, so uvicorn's
  default of 1 holds — do not add more without moving that store to the database.
- **WhatsApp delivery is not automated.** Reports are downloaded and sent
  manually. The Meta Cloud API implementation is complete and can be switched on
  later with `WHATSAPP_PROVIDER=meta` plus credentials; the Twilio path is a stub
  that always fails.
- **Rotate the keys in `backend/.env`.** They are gitignored and were never
  committed, but they exist in plaintext on the development machine.
- **Migrations are the source of truth.** Startup refuses to boot if the database
  is not at the revision the code expects, rather than coming up green with
  missing columns. `AUTO_CREATE_SCHEMA=true` bypasses this for local work and
  tests only — never set it against a database you care about.
