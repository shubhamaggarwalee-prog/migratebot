# 🚀 MigrateBot

**Automated SaaS migration platform** — move any project from GitHub, Replit, or Emergent onto Vercel + Railway + Supabase in minutes, powered by Claude AI analysis.

[![CI](https://github.com/shubhamaggarwalee-prog/migratebot/actions/workflows/ci.yml/badge.svg)](https://github.com/shubhamaggarwalee-prog/migratebot/actions/workflows/ci.yml)
[![Deploy](https://github.com/shubhamaggarwalee-prog/migratebot/actions/workflows/deploy.yml/badge.svg)](https://github.com/shubhamaggarwalee-prog/migratebot/actions/workflows/deploy.yml)

---

## Table of Contents

1. [What it does](#what-it-does)
2. [Tech stack](#tech-stack)
3. [Monorepo structure](#monorepo-structure)
4. [Quick start (local dev)](#quick-start-local-dev)
5. [Environment variables](#environment-variables)
6. [Migration sources](#migration-sources)
7. [Pricing](#pricing)
8. [API reference](#api-reference)
9. [CI / CD](#ci--cd)
10. [Contributing](#contributing)

---

## What it does

MigrateBot takes a source URL (GitHub repo, Replit project, or Emergent app), runs Claude AI analysis on the code, generates a deployment plan, collects payment, then autonomously deploys the project to the user’s own Vercel + Railway + Supabase accounts — streaming real-time progress over WebSocket.

**Key capabilities:**
- Multi-source ingestion: GitHub, Replit (monolith-aware), Emergent (full-stack-aware)
- Claude-powered code analysis and deployment plan generation
- Encrypted credential storage (AES-256-GCM) for target-platform tokens
- Stripe payment with per-tier pricing before deployment starts
- Live terminal log streaming via Socket.io
- AI agent chat during deployment for mid-flight decisions
- Notification preferences (email + in-app) and optional Slack webhook
- 2FA (TOTP), email verification, and password reset
- Fully responsive UI (hamburger sidebar ≤ 768 px)

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, `react-hot-toast`, Socket.io client |
| Backend | Node.js, Express 4, Bull (job queue), Socket.io server |
| Database | Supabase (PostgreSQL + Row-Level Security) |
| Cache / Queue | Redis (Railway-hosted) |
| Payments | Stripe |
| AI | Anthropic Claude (`@anthropic-ai/sdk`) |
| Email | SendGrid |
| Auth | JWT (jsonwebtoken) + bcryptjs + TOTP (speakeasy) |
| Encryption | AES-256-GCM via Node `crypto` |
| Deploy – frontend | Vercel |
| Deploy – backend | Railway |
| CI / CD | GitHub Actions |

---

## Monorepo structure

```
migratebot/
├── frontend/                      # Next.js app (Vercel)
│   ├── components/
│   │   ├── AgentChat.jsx          # AI chat panel during migration
│   │   ├── CostEstimateCard.jsx   # Pricing breakdown
│   │   ├── CredentialRetry.jsx    # Token re-entry flow
│   │   ├── DomainSetup.jsx        # Custom domain wiring
│   │   ├── ErrorBoundary.jsx      # Global React error boundary
│   │   ├── HealthWidget.jsx       # App health dashboard widget
│   │   ├── Layout.jsx             # Responsive sidebar layout
│   │   ├── MigrationCard.jsx      # Migration list item
│   │   ├── OnboardingTour.jsx     # First-run product tour
│   │   ├── PaymentForm.jsx        # Stripe Elements wrapper
│   │   ├── PushChange.jsx         # Post-deploy change push UI
│   │   ├── StatusBadge.jsx        # Coloured status pill
│   │   ├── Term.jsx               # WebSocket terminal log
│   │   ├── TokenWalkthrough.jsx   # Per-platform token help
│   │   └── WhatHappensNext.jsx    # Post-payment explainer
│   ├── context/
│   │   └── AuthContext.jsx        # JWT auth state + helpers
│   ├── lib/
│   │   └── api.js                 # Centralised fetch client (Gap 9)
│   ├── pages/
│   │   ├── _app.jsx               # Global providers + ErrorBoundary
│   │   ├── index.jsx              # Marketing / landing page
│   │   ├── login.jsx
│   │   ├── signup.jsx
│   │   ├── dashboard.jsx          # Migration history + stats
│   │   ├── migrate.jsx            # 5-step migration wizard
│   │   ├── settings.jsx           # Profile / Security / Credentials / Notifications
│   │   ├── update.jsx             # Post-deploy update wizard
│   │   ├── verify-email.jsx
│   │   └── reset-password.jsx
│   ├── styles/
│   │   └── globals.css            # Design tokens + responsive breakpoints
│   └── package.json
├── backend/                       # Express API (Railway)
│   ├── routes/
│   │   ├── auth.js                # Register / login / me
│   │   ├── migrations.js          # Migration CRUD + analyze + start
│   │   ├── credentials.js         # Encrypted credential store + validate
│   │   ├── notifications.js       # Prefs + Slack webhook
│   │   ├── billing.js             # Stripe payment intents + webhooks
│   │   ├── chat.js                # Agent chat messages
│   │   ├── pushChange.js          # Push code change to deployed app
│   │   ├── updateDeploy.js        # Re-deploy / update flow
│   │   ├── appHealth.js           # Live app health checks
│   │   ├── twoFactor.js           # TOTP enable / verify / disable
│   │   ├── emailVerification.js
│   │   ├── passwordReset.js
│   │   ├── receipt.js
│   │   ├── uploadSource.js
│   │   ├── webhooks.js
│   │   ├── agentChat.js
│   │   └── health.js
│   ├── agent/
│   │   └── analyzer.js            # Claude-powered code analysis
│   ├── middleware/
│   │   └── auth.js                # JWT verification middleware
│   ├── services/              # Platform-specific API clients
│   ├── utils/                 # DB, encryption, queue, logger
│   ├── __tests__/             # Jest test suite (7 files)
│   └── server.js
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                 # Lint + build + test on every push/PR
│   │   ├── deploy.yml             # Deploy to Vercel + Railway on main merge
│   │   └── secret-scan.yml        # Gitleaks secret scanning on PRs
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md                     # Complete API reference
│   └── SETUP.md                   # Developer setup guide
├── .env.example
├── deploy.sh                      # One-command server setup
├── railway.json
├── vercel.json
└── jest.config.js
```

---

## Quick start (local dev)

See **[docs/SETUP.md](docs/SETUP.md)** for the full guide. TL;DR:

```bash
# 1. Clone
git clone https://github.com/shubhamaggarwalee-prog/migratebot.git
cd migratebot

# 2. Environment
cp .env.example .env
# Fill in all values (see docs/SETUP.md § Environment variables)

# 3. Backend
cd backend && npm install && npm run dev

# 4. Frontend (new terminal)
cd frontend && npm install && npm run dev

# Frontend: http://localhost:3000
# Backend:  http://localhost:3001
```

---

## Environment variables

All variables are documented in [`.env.example`](.env.example). Key groups:

| Group | Variables |
|---|---|
| Supabase | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` |
| Redis | `REDIS_URL` |
| Stripe | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` |
| GitHub | `GITHUB_TOKEN`, `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET` |
| Auth | `JWT_SECRET`, `JWT_EXPIRES_IN`, `ENCRYPTION_KEY` |
| Email | `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` |
| AI | `ANTHROPIC_API_KEY` |
| Frontend | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

Generate secrets:
```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# ENCRYPTION_KEY (must be 64 hex chars = 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Migration sources

| Source | URL format | Notes |
|---|---|---|
| **GitHub** | `github.com/user/repo` | Standard repos, any branch |
| **Replit** | `replit.com/@user/project` | Monolith-aware splitting |
| **Emergent** | `emergent.dev/project/id` | Full-stack directory-aware |
| **URL / zip** | Direct link | Raw source upload |

---

## Pricing

| Tier | Price | Details |
|---|---|---|
| Standard | $100 | Single-service deploy |
| Pro | $250 | Multi-service + custom domain |

Payment is collected via Stripe before the migration job starts. Receipts are emailed automatically.

---

## API reference

See **[docs/API.md](docs/API.md)** for the complete REST API documentation.

Base URL (production): `https://api.migratebot.io`  
All authenticated endpoints require: `Authorization: Bearer <jwt>`

---

## CI / CD

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | Every push / PR to main | ESLint + Next.js build + Jest with coverage |
| `deploy.yml` | Push to `main` | Vercel (frontend) + Railway (backend) + Slack notify |
| `secret-scan.yml` | Every PR / push to main | Gitleaks blocks accidental secret commits |

Required GitHub Secrets for deploy: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `RAILWAY_TOKEN`, `RAILWAY_SERVICE_ID`, `SLACK_DEPLOY_WEBHOOK` (optional).

---

## Contributing

1. Fork and create a feature branch
2. Follow the PR checklist in [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md)
3. Ensure `npm test` (backend) and `npm run lint && npm run build` (frontend) pass
4. Open a PR targeting `main` — CI must be green before merge
