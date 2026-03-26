# MigrateBot — Developer Setup Guide

This guide gets you from a fresh clone to a fully running local development environment.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 20 LTS | [nodejs.org](https://nodejs.org) |
| npm | ≥ 10 | bundled with Node 20 |
| Redis | ≥ 7 | `brew install redis` / Docker |
| Git | any | [git-scm.com](https://git-scm.com) |

You’ll also need free accounts on: **Supabase**, **Stripe** (test mode), **Anthropic**, **SendGrid**.

---

## 1 — Clone the repo

```bash
git clone https://github.com/shubhamaggarwalee-prog/migratebot.git
cd migratebot
```

---

## 2 — Environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in each value. Here’s what each group is for:

### Supabase
1. Create a project at [app.supabase.com](https://app.supabase.com)
2. Go to **Settings → API** and copy:
   - `SUPABASE_URL` — your project URL
   - `SUPABASE_ANON_KEY` — public anon key
   - `SUPABASE_SERVICE_ROLE_KEY` — service role key (keep secret)
3. Go to **Settings → Database** and copy the connection string into `DATABASE_URL`

### Redis
For local dev, start Redis with Docker:
```bash
docker run -d -p 6379:6379 redis:7-alpine
```
Set `REDIS_URL=redis://localhost:6379`

### Stripe
1. Create an account at [stripe.com](https://stripe.com) and stay in **test mode**
2. Go to **Developers → API keys** and copy the secret + publishable keys
3. Create two products (Standard $100, Pro $250) and copy their IDs into `STRIPE_PRODUCT_STANDARD_ID` / `STRIPE_PRODUCT_PRO_ID`
4. For webhooks locally, use the Stripe CLI:
   ```bash
   stripe listen --forward-to localhost:3001/api/billing/webhook
   ```
   Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`

### JWT & Encryption keys
Generate fresh values — never reuse across environments:
```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# ENCRYPTION_KEY (must be exactly 64 hex characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Anthropic
1. Get an API key at [console.anthropic.com](https://console.anthropic.com/account/keys)
2. Set `ANTHROPIC_API_KEY=sk-ant-...`

### SendGrid
1. Create a free account and generate an API key at [app.sendgrid.com](https://app.sendgrid.com)
2. Verify a sender email and set `SENDGRID_FROM_EMAIL`

### GitHub
For the GitHub credential validator:
1. Generate a Personal Access Token with `repo` scope at [github.com/settings/tokens](https://github.com/settings/tokens)
2. Set `GITHUB_TOKEN`

---

## 3 — Database schema

All migrations live in `supabase/`. Apply them via the Supabase dashboard SQL editor or CLI:

```bash
# Using Supabase CLI
npx supabase db push
```

Key tables:

```sql
users         — auth, profile, 2FA secret, notification prefs, Slack webhook
migrations    — migration records with status, analysis_result, tier
credentials   — AES-256-GCM encrypted platform tokens
payments      — Stripe payment records
```

---

## 4 — Backend

```bash
cd backend
npm install
npm run dev    # nodemon server.js, restarts on file change
```

Backend runs on **http://localhost:3001** by default (`PORT` in `.env`).

### Run tests
```bash
npm test                          # all tests
npm test -- --watch               # watch mode
npm test -- --coverage            # with coverage report
npm test -- --testPathPattern=notifications  # single file
```

Test files: `backend/__tests__/*.test.js` (7 files covering auth, encryption, health, migrations, notifications, credentials, billing).

---

## 5 — Frontend

```bash
cd frontend
npm install
npm run dev    # Next.js dev server with hot reload
```

Frontend runs on **http://localhost:3000**.

```bash
npm run lint   # ESLint via next lint
npm run build  # Production build check
```

### Key environment variables (frontend)

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

These must be prefixed with `NEXT_PUBLIC_` to be accessible in the browser.

---

## 6 — Making API calls (frontend)

Use the centralised API client at `frontend/lib/api.js` — **do not use raw `fetch`**:

```js
import api from '../lib/api';

// GET
const { migrations } = await api.get('/api/migrations');

// POST
const { migration } = await api.post('/api/migrations', {
  repourl: 'https://github.com/user/repo',
  source_platform: 'github',
});

// PUT
await api.put('/api/notifications/prefs', { migration_completed: false });

// DELETE
await api.delete(`/api/credentials/${id}`);
```

The client automatically attaches the JWT, handles 401 → redirect to login, and throws `ApiError` with `.status` and `.body` on failures.

---

## 7 — CSS / UI conventions

All styles are in `frontend/styles/globals.css` with a `mb-` prefix.

| Class | Use |
|---|---|
| `.mb-layout` / `.mb-sidebar` / `.mb-main` | Page shell |
| `.mb-card` | White card with border + radius |
| `.mb-btn`, `.mb-btn-primary`, `.mb-btn-danger`, `.mb-btn-ghost` | Buttons |
| `.mb-badge` | Status pill |
| `.mb-grid-4` / `.mb-grid-3` / `.mb-grid-2` | Responsive grids |
| `.mb-log-box` | Dark terminal output |
| `.mb-tab-bar` | Horizontally scrollable tab row |

**Breakpoints:**
- `≤ 1024px` — sidebar narrows, 4-col grid → 2-col
- `≤ 768px` — sidebar becomes hamburger drawer
- `≤ 640px` — single column, full-width buttons

**Design tokens (CSS variables):**
```css
--amber: #D97706;   /* primary accent */
--ink:   #1A1814;   /* body text */
--surface: #F8F7F4; /* page background */
--border:  #E5E2DA; /* borders */
```

---

## 8 — Deep links

Settings page supports tab deep-linking:

| URL | Opens |
|---|---|
| `/settings?tab=profile` | Profile tab |
| `/settings?tab=security` | Security (2FA) tab |
| `/settings?tab=credentials` | Credentials tab |
| `/settings?tab=notifications` | Notifications tab |
| `/settings?tab=danger` | Danger Zone tab |

---

## 9 — CI / CD

GitHub Actions run automatically on push. See [`.github/workflows/`](.github/workflows/) for full config.

To trigger a production deploy: merge a PR into `main`. Both CI jobs (lint + test) must be green first.

**Required GitHub Secrets** (Settings → Secrets and variables → Actions):

```
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
RAILWAY_TOKEN
RAILWAY_SERVICE_ID
SLACK_DEPLOY_WEBHOOK     (optional)
NEXT_PUBLIC_API_URL      (for build)
NEXT_PUBLIC_STRIPE_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## 10 — Troubleshooting

| Symptom | Fix |
|---|---|
| `ENCRYPTION_KEY must be 64 hex chars` | Re-generate with the command in § 2 |
| Backend crashes on start | Check `REDIS_URL` — Redis must be running |
| 401 on every API call | `JWT_SECRET` mismatch between `.env` and running process |
| Next.js build fails | Ensure all `NEXT_PUBLIC_*` vars are set in `.env` or CI secrets |
| Stripe webhook 400 | Run `stripe listen` locally and update `STRIPE_WEBHOOK_SECRET` |
| Gitleaks blocks PR | Add a `.gitleaks.toml` allowlist entry for the false positive |
