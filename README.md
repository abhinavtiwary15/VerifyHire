# VerifyHire — Hiring Fraud Detection Platform

An AI-powered platform that helps hiring teams detect resume fraud, identity spoofing, and interview cheating. Built as a Next.js + Fastify + Python monorepo.

---

## What Actually Works (Post-Fix)

| Feature | Status | Notes |
|---|---|---|
| **Resume analysis** (Gemini 1.5 Flash) | ✅ Real | Requires valid `GEMINI_API_KEY` |
| **Resume analysis** (Python perplexity/burstiness) | ✅ Real | FastAPI microservice, runs locally |
| **Resume analysis** (regex fallback) | ✅ Real | Fires only on actual API failure |
| **Interview frame analysis** (Gemini Vision) | ✅ Real | POST `/api/v1/interview/analyze-frame` |
| **Identity verification** (GitHub) | ✅ Real | Calls public GitHub API, no key needed |
| **Identity verification** (LinkedIn) | ⚠️ Stub | Returns fixed 60pts. Needs `PROXYCURL_API_KEY` for real data |
| **Fraud network hashing** | ✅ Fixed | HMAC-SHA256 with `FRAUD_HASH_SALT` (was unsalted SHA-256) |
| **BullMQ analysis queue** | ✅ Real | Requires Redis |
| **WebSocket alerts** | ✅ Real | JWT-authenticated |
| **Auth (JWT + API key)** | ✅ Real | Requires valid Neon DB |
| **Scoring engine** (Claude summary) | ⚠️ Fallback | `ANTHROPIC_API_KEY` not configured; uses static summary |
| **Voice biometrics** | ❌ Not implemented | Waveform is decorative. Needs AssemblyAI |
| **Deepfake detection** | ❌ Not implemented | Frame monitor flags observable anomalies only |
| **Stripe billing** | ❌ Stub | UI exists, no webhook handler |
| **ATS integrations** | ❌ Stub | UI only, no real OAuth flows |

---

## Stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, Zustand, Lucide
- **Backend API**: Fastify 4, TypeScript, BullMQ, Prisma 5, JWT
- **AI (text)**: Google Gemini 1.5 Flash via `@google/generative-ai`
- **AI (vision)**: Google Gemini 1.5 Flash (multimodal) via same SDK
- **AI (scoring summaries)**: Anthropic Claude (optional, graceful fallback)
- **Python microservice**: FastAPI + uvicorn — perplexity/burstiness/stylometric
- **Database**: PostgreSQL (Neon recommended), via Prisma ORM
- **Queue**: Redis (Upstash recommended) via BullMQ
- **Monorepo**: npm workspaces (`apps/*`, `packages/*`, `services/*`)

---

## Quick Start (Local)

### Prerequisites

- Node.js 20+
- Python 3.11+
- PostgreSQL (local or [Neon](https://neon.tech))
- Redis (local or [Upstash](https://upstash.com))

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment

Development credentials used during this project's build were rotated after the initial commit. See `.env.example` for the required environment variables — no real values are included.

```bash
cp .env.example .env
```

Fill in the required values:

```bash
# Minimum required for core features:
DATABASE_URL="postgresql://..."          # Neon or local
REDIS_URL="redis://localhost:6379"       # Local or Upstash
GEMINI_API_KEY="AIza..."                 # Google AI Studio
JWT_SECRET="$(openssl rand -hex 64)"
JWT_REFRESH_SECRET="$(openssl rand -hex 64)"
FRAUD_HASH_SALT="$(openssl rand -hex 32)"  # CRITICAL: never change after first use
```

### 3. Set up the database

```bash
npm run prisma:generate      # from apps/api
npm run prisma:migrate       # applies migrations to your DB
npm run prisma:seed          # optional: loads demo data
```

Or from the monorepo root:

```bash
cd apps/api && npx prisma migrate dev --name init && cd ../..
```

### 4. Start the services

```bash
# Terminal 1: API
npm run dev --workspace=apps/api      # http://localhost:4000

# Terminal 2: Frontend
npm run dev --workspace=apps/web      # http://localhost:3000

# Terminal 3: Python microservice
cd services/ai-analyzer
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

### 5. Log in

Visit `http://localhost:3000/auth/login`

Demo credentials (requires seeded DB):
- Email: `admin@acme.com`
- Password: `password123`

---

## Docker Compose

```bash
# Requires .env to be populated
docker compose up --build
```

Services:
- `api` → `localhost:4000`
- `web` → `localhost:3000`
- `ai-analyzer` → `localhost:8000`
- `postgres` → `localhost:5432`
- `redis` → `localhost:6379`

---

## Architecture

```
apps/
  api/       # Fastify API server (TypeScript, CommonJS)
  web/       # Next.js 14 frontend (App Router)
packages/
  types/     # Shared TypeScript types (@verifyhire/types)
services/
  ai-analyzer/  # Python FastAPI microservice
```

### Analysis Pipeline

```
POST /api/v1/candidates
  → BullMQ job: "full-analysis"
  → Worker: runFullAnalysis()
      ├── resumeAnalyzerService.analyze()
      │     ├── Python microservice: perplexity/burstiness (primary)
      │     └── Gemini 1.5 Flash: work history verification (primary)
      │         └── regex fallback (on API failure only)
      ├── identityVerifierService.verify()
      │     ├── GitHub API (real, no key needed)
      │     └── IPQualityScore (optional)
      └── fraudNetworkService.check()
            └── HMAC-SHA256 cross-tenant matching
  → scoringEngine.compute()
        ├── CAS = 0.25·resume + 0.20·workHistory + 0.20·identity + 0.25·interview + 0.10·network
        └── Claude summary (optional, fallback to static)
  → Prisma: update candidate record
```

### Interview Monitor

The live interview page (`/interview`) captures webcam frames via `canvas.drawImage()` and sends them every 8 seconds to `POST /api/v1/interview/analyze-frame`, which calls Gemini 1.5 Flash Vision to detect:

- Face presence / absence
- Multiple people in frame
- Candidate looking significantly off-screen
- Poor lighting / covered camera

> [!IMPORTANT]
> This is **not** a deepfake detection model. It flags observable visual anomalies. All flags are advisory only.

---

## Tests

```bash
npm test --workspace=apps/api
```

15 tests across 4 suites:
- `scoring-engine.test.ts` — CAS formula, risk levels, weight validation
- `fraud-hash.test.ts` — HMAC hashing consistency, salt independence, hex format
- `auth-flow.test.ts` — `maskEmail`, `maskPhone` utility functions
- `resume-analyzer.test.ts` — fallback scoring discrimination, buzzphrase detection

---

## Security Notes

### Environment Secrets Management

| Secret | Purpose | Management & Generation |
|---|---|---|
| `GEMINI_API_KEY` | Resume & interview frame analysis | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `DATABASE_URL` | PostgreSQL connection | Neon or local PostgreSQL instance |
| `REDIS_URL` | Background task queue & pub/sub | Upstash or local Redis instance |
| `JWT_SECRET` | API authentication tokens | Generate via `openssl rand -hex 64` |
| `FRAUD_HASH_SALT` | Cross-tenant HMAC hashing salt | Generate via `openssl rand -hex 32` (persistent per deployment) |

### Privacy Architecture

PII (email, phone) is hashed using HMAC-SHA256 with `FRAUD_HASH_SALT` before being stored in the fraud network cross-tenant database. Raw PII is never shared cross-tenant. The salt prevents rainbow table attacks against the hash store.

### Compliance Disclaimer

> [!WARNING]
> Using AI-assisted hiring tools may have legal obligations under:
> - **FCRA** (Fair Credit Reporting Act) if scores are used for adverse action
> - **NYC Local Law 144** (AEDT bias audits for AI hiring tools)
> - **Illinois AEIA**, **California AB 331**, and other state AI employment laws
>
> This codebase does not implement bias auditing, adverse action notices, or FCRA-compliant dispute resolution. Consult legal counsel before deploying in a real hiring context.

---

## LinkedIn Integration

LinkedIn data requires [Proxycurl](https://nubela.co/proxycurl/) (`$0.01/check`, Pro plan). Without `PROXYCURL_API_KEY`, the `checkLinkedInProfile()` function returns a fixed 60-point fallback score and logs a warning. This is documented behavior, not a bug.

---

## Project Status

This is a functional prototype demonstrating the architecture of an AI-assisted hiring fraud detection platform. Core analysis pipelines are real. Several features (billing, ATS OAuth, voice biometrics) are UI stubs that would require additional third-party integrations.
