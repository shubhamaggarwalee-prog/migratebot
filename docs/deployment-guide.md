# 🚀 Deployment Guide

## Quick Deploy (Recommended)

```bash
chmod +x deploy.sh
./deploy.sh
```

Or visit `/setup` in your browser.

## Manual Deploy

### Phase 1: Supabase
1. Go to [supabase.com](https://supabase.com) → New project → `migratebot`
2. Save: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### Phase 2: Stripe
1. Create products: Standard ($100), Pro ($250)
2. Create webhook → save `STRIPE_WEBHOOK_SECRET`

### Phase 3: Railway
1. New project → Deploy from GitHub
2. Add Redis database
3. Set all env vars (see `.env.example`)

### Phase 4: Vercel
1. Import frontend repo
2. Set `NEXT_PUBLIC_API_URL` to Railway URL
3. Deploy

### Phase 5: Wire Up
1. Update Supabase Auth → Site URL to Vercel URL
2. Update Stripe webhook URL to Railway URL
3. Update `FRONTEND_URL` in Railway to Vercel URL

## Environment Variables

See `.env.example` for complete list.

## Health Checks

```bash
curl https://your-railway-url.up.railway.app/health
# {"status":"ok"}
```
