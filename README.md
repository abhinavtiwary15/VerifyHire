# VerifyHire

VerifyHire is an open-source, AI-powered candidate authenticity and hiring fraud detection platform. It helps recruiting teams and hiring managers identify AI-generated resumes, verify claimed work histories and online identities, detect cross-organization duplicate applications, and monitor video interviews for visual anomalies in real time.

---

## Architecture Overview

```
                          ┌──────────────────────────┐
                          │   Next.js 14 Frontend    │
                          │ (Dashboard, Live Monitor)│
                          └────────────┬─────────────┘
                                       │ HTTP / WebSocket
                                       ▼
                          ┌──────────────────────────┐
                          │    Fastify REST & WS     │
                          │       API Server         │
                          └──────┬────────────┬──────┘
                                 │            │
            ┌────────────────────┴──┐      ┌──┴────────────────────┐
            ▼                       ▼      ▼                       ▼
   ┌─────────────────┐    ┌─────────────┐┌─────────────────┐ ┌─────────────┐
   │  PostgreSQL     │    │ Redis /     ││ Python FastAPI  │ │ Google      │
   │  (Prisma ORM)   │    │ BullMQ      ││ AI Analyzer     │ │ Gemini &    │
   │                 │    │ Task Queue  ││ (Stylometrics)  │ │ Claude LLMs │
   └─────────────────┘    └─────────────┘└─────────────────┘ └─────────────┘
```

VerifyHire is organized as an npm workspaces monorepo:

- **`apps/web`**: Next.js 14 (App Router) dashboard, candidate evaluation views, ATS integration console, and live interview monitor.
- **`apps/api`**: Fastify 4 backend providing REST endpoints, WebSocket event broadcasting, BullMQ background worker queues, and Prisma ORM data modeling.
- **`packages/types`**: Shared TypeScript interfaces, risk level enums, and data contracts used across frontend and backend services.
- **`services/ai-analyzer`**: Python FastAPI microservice calculating text burstiness, perplexity proxy metrics, and stylometric markers to detect synthetic resumes.

---

## How It Works

VerifyHire computes an aggregated **Candidate Authenticity Score (CAS)** from 0 to 100 across five weighted dimensions:

### 1. Resume Authenticity (25%)
Resume text is analyzed by the Python microservice to calculate:
- **Lexical Entropy & Perplexity Proxy**: Measures word-length sequence predictability.
- **Burstiness**: Evaluates the coefficient of variation in sentence length (human writing varies naturally; synthetic text tends toward uniformity).
- **Stylometric Signals**: Scans for AI buzzword density, pronoun frequency, and repetitive structural patterns.

### 2. Work History Verification (20%)
Gemini 1.5 Flash examines the candidate's career progression, checking timeline continuity, title plausibility, and flaggable anomalies against expected industry career trajectories.

### 3. Identity & Online Presence (20%)
- **GitHub Verification**: Directly queries the public GitHub REST API to assess account age, repository activity, and public engagement.
- **LinkedIn Profile Alignment**: Inspects vanity URL structure, validates formatting, and correlates name tokens in the URL slug with the candidate's legal name.
- **Contact Integrity**: Validates phone numbers, formats, and email domains against disposable mail patterns.

### 4. Live Interview Integrity Monitor (25%)
During live technical or behavioral interviews, the browser captures webcam frames at fixed intervals via HTML5 Canvas and transmits them to Gemini 1.5 Flash Vision. The vision pipeline identifies:
- Candidate face presence and sustained visibility
- Multiple persons appearing simultaneously in frame
- Candidate looking significantly off-screen for extended periods
- Lighting irregularities and camera occlusion

### 5. Cross-Tenant Fraud Network (10%)
To prevent candidate identity spoofing and syndicates submitting identical profiles across multiple companies, candidate contact identifiers are hashed using **HMAC-SHA256** keyed with a deployment secret (`FRAUD_HASH_SALT`). Raw PII is never stored or shared across tenants.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 14 (App Router), React 18, Tailwind CSS, Zustand, TanStack Query, Lucide Icons |
| **Backend API** | Fastify 4, TypeScript, Prisma ORM, BullMQ, WebSocket (`ws`), Node.js crypto |
| **Microservice** | Python 3.11+, FastAPI, Uvicorn, Pydantic, standard library statistics |
| **AI & Vision** | Google Gemini 1.5 Flash (`@google/generative-ai`), Anthropic Claude 3.5 Sonnet (`@anthropic-ai/sdk`) |
| **Datastores** | PostgreSQL 16, Redis 7 (or Upstash Redis) |
| **Infrastructure** | Docker, Docker Compose |

---

## Getting Started

### Prerequisites

- Node.js 20+ and npm 10+
- Python 3.11+
- PostgreSQL instance (local or hosted via [Neon](https://neon.tech))
- Redis instance (local or hosted via [Upstash](https://upstash.com))
- Google Gemini API key (from [Google AI Studio](https://aistudio.google.com/app/apikey))

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/abhinavtiwary15/VerifyHire.git
cd VerifyHire

# Install monorepo dependencies across apps and packages
npm install

# Install Python microservice requirements
cd services/ai-analyzer
pip install -r requirements.txt
cd ../..
```

### 2. Configure Environment Variables

Copy the example environment template:

```bash
cp .env.example .env
```

Configure the following variables in `.env`:

```env
# Database & Redis
DATABASE_URL="postgresql://postgres:password@localhost:5432/verifyhire"
REDIS_URL="redis://localhost:6379"

# AI Services
GEMINI_API_KEY="your-gemini-api-key"
ANTHROPIC_API_KEY="" # Optional: activates Claude 3.5 Sonnet executive summaries

# Authentication & Cryptography
JWT_SECRET="generate-with-openssl-rand-hex-64"
JWT_REFRESH_SECRET="generate-with-openssl-rand-hex-64"
FRAUD_HASH_SALT="generate-with-openssl-rand-hex-32"

# Ports & URLs
PORT=4000
FRONTEND_URL="http://localhost:3000"
NEXT_PUBLIC_API_URL="http://localhost:4000"
NEXT_PUBLIC_WS_URL="ws://localhost:4000"
AI_SERVICE_URL="http://localhost:8000"
AI_SERVICE_SECRET="internal-service-secret"
```

### 3. Initialize Database

Generate the Prisma client and apply migrations:

```bash
# From apps/api
cd apps/api
npx prisma generate
npx prisma migrate dev --name init
cd ../..
```

### 4. Run the Development Environment

Start all three services concurrently in separate terminal windows:

```bash
# Terminal 1: Backend API (port 4000)
npm run dev --workspace=apps/api

# Terminal 2: Web Dashboard (port 3000)
npm run dev --workspace=apps/web

# Terminal 3: Python AI Analyzer (port 8000)
cd services/ai-analyzer
uvicorn main:app --reload --port 8000
```

Once running, access the web interface at **`http://localhost:3000`**.

---

## Docker Compose Deployment

VerifyHire can be run entirely in Docker containers:

```bash
docker compose up --build
```

This starts:
- **`postgres`** on port `5432`
- **`redis`** on port `6379`
- **`api`** on port `4000`
- **`web`** on port `3000`
- **`ai-analyzer`** on port `8000`

---

## ATS & Webhook Integration

VerifyHire supports bidirectional ATS integration:

- **Inbound Candidate Ingestion**:
  - `POST /api/v1/webhooks/greenhouse` — Ingests application events from Greenhouse Harvest webhooks.
  - `POST /api/v1/webhooks/lever` — Ingests candidate opportunities from Lever webhooks.
  - `POST /api/v1/webhooks/generic` — Universal REST webhook for Ashby, Workday, BambooHR, or custom scripts.
  - Authenticate all inbound requests using the `x-api-key: [Your API Key]` header.
- **Outbound Score Dispatch**:
  - Delivers real-time candidate scores and alerts to your configured webhook URL upon analysis completion.
  - Every payload is signed with an `X-VerifyHire-Signature` header computed as an HMAC-SHA256 digest for end-to-end payload authenticity.

---

## Running Tests

VerifyHire includes automated unit and integration tests covering the weighted CAS algorithm, HMAC fraud hashing, authentication masking helpers, and resume stylometric heuristics:

```bash
npm test --workspace=apps/api
```

---

## Legal & Compliance Disclaimer

VerifyHire is an advisory software platform designed to assist recruiting teams in identifying technical and behavioral anomalies. VerifyHire is not a consumer reporting agency, and its scores, flags, and outputs do not constitute a "consumer report" under the Fair Credit Reporting Act (FCRA). The platform is not intended to be the sole determinant in any employment decision. Organizations utilizing AI-assisted hiring tools remain responsible for compliance with applicable federal, state, and local hiring regulations, including New York City Local Law 144, the Illinois Artificial Intelligence Video Interview Act, and EEOC employment guidance.
