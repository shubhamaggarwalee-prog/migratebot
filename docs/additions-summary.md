# Additions Summary

## Addition 1 — Three Migration Sources

### Frontend Changes
- `pages/migrate.jsx` — Step 1 now shows GitHub / Replit / Emergent selector
- Each source has icon, description, URL input, validation regex
- Replit shows monolith warning banner
- Emergent shows auto-split info banner
- Branch field shows only for GitHub

### Backend Changes
- `services/replit.js` — NEW: fetches Replit project, detects .replit config, analyzes monolith structure
- `services/emergent.js` — NEW: fetches Emergent project, detects /web /api /db dirs, suggests deployment targets
- `agent/analyzer.js` — UPDATED: routes analysis to correct service by platform
- `pages/api/migrations/validate-source.js` — NEW: validates URL before Step 2

### Database
- `source_platform` column added to migrations table
- Stores: 'github' | 'replit' | 'emergent'

## Addition 2 — One-Click Automated Deployment

### Bash Script
- `deploy.sh` — prompts 5 keys, creates Supabase + Stripe, generates secrets, saves .env

### Web UI
- `pages/setup.jsx` — 5 input fields, deploy button, real-time log stream, success URLs
- `pages/api/deploy.js` — streams NDJSON logs, orchestrates all 4 platforms

### Design
- Cream (#F8F7F4) background throughout
- Amber (#D97706) accent color on all CTAs
- Consistent with existing pages
