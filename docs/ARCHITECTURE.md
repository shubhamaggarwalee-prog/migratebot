# MigrateBot Architecture

## System Overview

```
Vercel (Frontend)
  └── Next.js pages
  └── Calls Railway backend via REST + WebSocket

Railway (Backend)
  └── Node.js + Express API
  └── Bull job queue (Redis)
  └── WebSocket server
  └── Calls: Supabase, Stripe, GitHub, Claude

Supabase (Database + Auth)
  └── PostgreSQL (users, migrations, credentials)
  └── Row-Level Security
  └── JWT Auth

Redis (Cache + Queue)
  └── Bull job queue for background migration jobs
  └── Session storage
```

## Migration Flow

```
User selects source (GitHub / Replit / Emergent)
  → Validates URL
  → Fetches project metadata
  → Claude analyzes code
  → User picks platforms
  → Stripe payment
  → Background job runs migration
  → WebSocket streams progress
  → Migration live!
```

## Source Handlers

| Source | Service | Key Feature |
|--------|---------|-------------|
| GitHub | services/github.js | Standard repo cloning |
| Replit | services/replit.js | Monolith splitting |
| Emergent | services/emergent.js | Directory-aware deployment |

## Database Schema

```sql
migrations (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users,
  source_platform TEXT, -- github|replit|emergent
  repourl TEXT,
  reponame TEXT,
  branch TEXT DEFAULT 'main',
  status TEXT,
  analysis_result JSONB,
  created_at TIMESTAMP
);
```
