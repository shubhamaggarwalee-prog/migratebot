# 🚀 MigrateBot

**Automated SaaS deployment platform — migrate from GitHub, Replit, or Emergent to Vercel + Railway + Supabase in minutes.**

## ⚡ One-Click Deploy

```bash
chmod +x deploy.sh
./deploy.sh
```

Or visit `/setup` in the web UI for a guided experience.

## 🔑 5 API Keys Required

| Service | Get Key |
|---------|--------|
| Supabase | [app.supabase.com/account/tokens](https://app.supabase.com/account/tokens) |
| Stripe | [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys) |
| Railway | [railway.app/account/tokens](https://railway.app/account/tokens) |
| Vercel | [vercel.com/account/tokens](https://vercel.com/account/tokens) |
| Anthropic | [console.anthropic.com/account/keys](https://console.anthropic.com/account/keys) |

## 📦 Project Structure

```
migratebot/
├── pages/
│   ├── migrate.jsx          # 5-step wizard (3 sources)
│   ├── setup.jsx            # One-click deploy UI
│   ├── dashboard.jsx        # Main dashboard
│   ├── settings.jsx         # Settings
│   └── api/
│       ├── deploy.js        # Deploy orchestration
│       └── migrations/
│           └── validate-source.js
├── services/
│   ├── replit.js            # Replit support
│   └── emergent.js          # Emergent support
├── agent/
│   └── analyzer.js          # Multi-source analyzer
└── deploy.sh                # Bash automation
```

## 🌐 Migration Sources

| Source | URL Format | Notes |
|--------|-----------|-------|
| **GitHub** | `github.com/user/repo` | Standard repos |
| **Replit** | `replit.com/@user/project` | Monolith-aware |
| **Emergent** | `emergent.dev/project/id` | Full-stack aware |

## 💰 Pricing

- **Standard Migration**: $100
- **Pro Migration**: $250
- **Enterprise**: Custom

## 🛠️ Tech Stack

- **Frontend**: Next.js → Vercel
- **Backend**: Node.js + Express → Railway
- **Database**: Supabase (PostgreSQL)
- **Cache/Jobs**: Redis (Railway)
- **Payments**: Stripe
- **AI Analysis**: Claude (Anthropic)

## 📖 Documentation

- [Deployment Guide](docs/deployment-guide.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Integration Guide](docs/integration-guide.md)
