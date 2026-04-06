#!/bin/bash
# ============================================================
# MigrateBot Automated Deployment Script
# From zero to live production in ~5 minutes
# Run: chmod +x deploy.sh && ./deploy.sh
# ============================================================
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
info() { echo -e "${YELLOW}ℹ${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1"; exit 1; }

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  🚀 MigrateBot One-Click Deployment     ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "You need 5 API keys + your Railway backend URL:"
echo "  Supabase: https://app.supabase.com/account/tokens"
echo "  Stripe:   https://dashboard.stripe.com/apikeys"
echo "  Railway:  https://railway.app/account/tokens"
echo "  Vercel:   https://vercel.com/account/tokens"
echo "  Anthropic:https://console.anthropic.com/account/keys"
echo ""
echo "  Railway backend URL — the public domain Railway assigned to your"
echo "  backend service (e.g. https://migratebot-production.up.railway.app)."
echo "  Deploy the backend to Railway first, then run this script."
echo ""

read -sp "Supabase Access Token: " SUPABASE_TOKEN; echo
read -sp "Stripe Secret Key (sk_test_...): " STRIPE_KEY; echo
read -sp "Railway API Token: " RAILWAY_TOKEN; echo
read -sp "Vercel API Token: " VERCEL_TOKEN; echo
read -sp "Anthropic API Key (sk-ant-...): " ANTHROPIC_KEY; echo
read -p  "Railway Backend URL (https://...): " RAILWAY_BACKEND_URL; echo

[ -z "$SUPABASE_TOKEN" ]      && err "Supabase token required"
[ -z "$STRIPE_KEY" ]          && err "Stripe key required"
[ -z "$RAILWAY_TOKEN" ]       && err "Railway token required"
[ -z "$VERCEL_TOKEN" ]        && err "Vercel token required"
[ -z "$ANTHROPIC_KEY" ]       && err "Anthropic key required"
[ -z "$RAILWAY_BACKEND_URL" ] && err "Railway backend URL required"

# Strip trailing slash
RAILWAY_BACKEND_URL="${RAILWAY_BACKEND_URL%/}"

ok "All inputs received"

# ── SUPABASE ──────────────────────────────────────────────────
echo -e "\n${BLUE}Step 1: Creating Supabase project...${NC}"
DB_PASS=$(openssl rand -base64 12)
SB_RESPONSE=$(curl -sf -X POST https://api.supabase.com/v1/projects \
  -H "Authorization: Bearer $SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"migratebot\",\"db_pass\":\"$DB_PASS\",\"region\":\"us-east-1\"}" 2>&1) || err "Supabase API call failed: $SB_RESPONSE"
PROJECT_ID=$(echo "$SB_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null) || err "Could not parse Supabase project ID"
ok "Supabase project created: $PROJECT_ID"

info "Waiting for Supabase to be active (up to 2 min)..."
for i in $(seq 1 120); do
  STATUS=$(curl -sf -H "Authorization: Bearer $SUPABASE_TOKEN" "https://api.supabase.com/v1/projects/$PROJECT_ID" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null)
  [ "$STATUS" = "ACTIVE_HEALTHY" ] && { ok "Supabase is active"; break; }
  [ $i -eq 120 ] && err "Supabase timed out after 120s"
  printf "\r  Waiting... ($i/120) [$STATUS]   "
  sleep 1
done
SUPABASE_URL=$(curl -sf -H "Authorization: Bearer $SUPABASE_TOKEN" "https://api.supabase.com/v1/projects/$PROJECT_ID" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('api_url',''))" 2>/dev/null)
ok "Supabase URL: $SUPABASE_URL"

# ── STRIPE ────────────────────────────────────────────────────
echo -e "\n${BLUE}Step 2: Creating Stripe products + webhook...${NC}"
STRIPE_AUTH=$(python3 -c "import base64; print('Basic ' + base64.b64encode(b':$STRIPE_KEY').decode())")

STD_ID=$(curl -sf -X POST https://api.stripe.com/v1/products \
  -H "Authorization: $STRIPE_AUTH" \
  -d "name=Standard+Migration" -d "type=service" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
ok "Standard product: $STD_ID"

PRO_ID=$(curl -sf -X POST https://api.stripe.com/v1/products \
  -H "Authorization: $STRIPE_AUTH" \
  -d "name=Pro+Migration" -d "type=service" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
ok "Pro product: $PRO_ID"

# Register the webhook to the correct /api/webhooks/stripe path.
# All three events that webhooks.js handles are registered:
#   payment_intent.succeeded    — marks migration paid, triggers job
#   payment_intent.payment_failed — marks migration payment_failed
#   charge.refunded             — logged for records
WEBHOOK_URL="${RAILWAY_BACKEND_URL}/api/webhooks/stripe"
WH=$(curl -sf -X POST https://api.stripe.com/v1/webhook_endpoints \
  -H "Authorization: $STRIPE_AUTH" \
  -d "url=${WEBHOOK_URL}" \
  -d "enabled_events[]=payment_intent.succeeded" \
  -d "enabled_events[]=payment_intent.payment_failed" \
  -d "enabled_events[]=charge.refunded")
WH_ID=$(echo "$WH" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
WH_SECRET=$(echo "$WH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('secret',''))" 2>/dev/null)
ok "Stripe webhook registered → ${WEBHOOK_URL} (${WH_ID})"

# ── GENERATE SECRETS ─────────────────────────────────────────
echo -e "\n${BLUE}Step 3: Generating secrets...${NC}"
ENCRYPTION_KEY=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -base64 32)
ok "ENCRYPTION_KEY generated (64-char hex)"
ok "JWT_SECRET generated (32-char base64)"

# ── SAVE CONFIG ──────────────────────────────────────────────
cat > .migratebot.env.production << ENVEOF
# MigrateBot Production Configuration
# Generated: $(date)
# WARNING: Keep this file secret! Add to .gitignore

SUPABASE_URL=$SUPABASE_URL
SUPABASE_DB_PASS=$DB_PASS

STRIPE_SECRET_KEY=$STRIPE_KEY
STRIPE_PRODUCT_STANDARD_ID=$STD_ID
STRIPE_PRODUCT_PRO_ID=$PRO_ID
STRIPE_WEBHOOK_SECRET=$WH_SECRET

ENCRYPTION_KEY=$ENCRYPTION_KEY
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d

ANTHROPIC_API_KEY=$ANTHROPIC_KEY

RAILWAY_BACKEND_URL=$RAILWAY_BACKEND_URL
# VERCEL_FRONTEND_URL=https://migratebot.vercel.app  # fill in after Vercel deploy
ENVEOF
ok "Saved to .migratebot.env.production"

# ── NEXT STEPS ───────────────────────────────────────────────
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Phase 1 Complete! Supabase + Stripe ready.${NC}\n"
echo "Next steps to finish deployment:"
echo ""
echo "  1. Set all env vars from .migratebot.env.production on Railway"
echo "     (Settings → Variables in your Railway backend service)"
echo ""
echo "  2. Connect GitHub repo to Vercel → vercel.com"
echo "     Root directory: frontend"
echo "     Set NEXT_PUBLIC_API_URL=$RAILWAY_BACKEND_URL"
echo ""
echo "  OR: Visit $RAILWAY_BACKEND_URL/setup for full web UI automation"
echo ""
echo -e "${YELLOW}⚠  Add .migratebot.env.production to .gitignore${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
