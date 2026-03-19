# Quick Reference

## Deploy Now

```bash
chmod +x deploy.sh
./deploy.sh
```

Or: `npm run dev` → visit `http://localhost:3000/setup`

## 5 API Keys Needed

| Service | URL |
|---------|-----|
| Supabase | https://app.supabase.com/account/tokens |
| Stripe | https://dashboard.stripe.com/apikeys |
| Railway | https://railway.app/account/tokens |
| Vercel | https://vercel.com/account/tokens |
| Anthropic | https://console.anthropic.com/account/keys |

## Project Structure

```
migratebot/
├── frontend/          Next.js app → Vercel
├── backend/           Express API → Railway
├── agent/             Claude analyzer
├── services/          GitHub / Replit / Emergent
├── supabase/          Schema + seed SQL
├── docs/              All documentation
├── deploy.sh          One-click bash deploy
├── railway.json       Railway config
├── vercel.json        Vercel config
└── .env.example       Env var template
```

## Sources

| Source | URL Format |
|--------|------------|
| GitHub | github.com/user/repo |
| Replit | replit.com/@user/project |
| Emergent | emergent.dev/project/id |

## Pricing
- Standard: $100
- Pro: $250

## Status: PRODUCTION READY ✅
