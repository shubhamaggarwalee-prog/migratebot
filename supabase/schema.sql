-- ============================================================
-- MigrateBot Supabase Schema
-- Run this manually ONLY if initDatabase() auto-run fails
-- Usually auto-created on first backend boot
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── MIGRATIONS TABLE ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS migrations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL,
  repourl                 TEXT NOT NULL,
  reponame                TEXT,
  branch                  TEXT DEFAULT 'main',
  source_platform         TEXT DEFAULT 'github' CHECK (source_platform IN ('github', 'replit', 'emergent')),
  tier                    TEXT DEFAULT 'standard' CHECK (tier IN ('standard', 'pro')),
  status                  TEXT DEFAULT 'pending' CHECK (status IN (
                            'pending', 'analyzing', 'analyzed', 'paid',
                            'deploying', 'complete', 'failed', 'payment_failed'
                          )),
  analysis_result         JSONB,
  deploy_config           JSONB,
  stripe_payment_intent_id TEXT,
  vercel_project_id       TEXT,
  railway_project_id      TEXT,
  error_message           TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ── CREDENTIALS TABLE ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credentials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id    UUID REFERENCES migrations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  platform        TEXT NOT NULL,
  encrypted_data  TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── DEPLOY LOGS TABLE ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deploy_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id    UUID REFERENCES migrations(id) ON DELETE CASCADE,
  message         TEXT NOT NULL,
  level           TEXT DEFAULT 'info' CHECK (level IN ('info', 'success', 'error', 'warn')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_migrations_user_id     ON migrations(user_id);
CREATE INDEX IF NOT EXISTS idx_migrations_status      ON migrations(status);
CREATE INDEX IF NOT EXISTS idx_migrations_platform    ON migrations(source_platform);
CREATE INDEX IF NOT EXISTS idx_credentials_migration  ON credentials(migration_id);
CREATE INDEX IF NOT EXISTS idx_deploy_logs_migration  ON deploy_logs(migration_id);
CREATE INDEX IF NOT EXISTS idx_deploy_logs_created    ON deploy_logs(created_at);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────
ALTER TABLE migrations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE deploy_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own migrations
CREATE POLICY "Users see own migrations" ON migrations
  FOR ALL USING (auth.uid() = user_id);

-- Users can only see their own credentials
CREATE POLICY "Users see own credentials" ON credentials
  FOR ALL USING (auth.uid() = user_id);

-- Users can only see logs for their own migrations
CREATE POLICY "Users see own deploy logs" ON deploy_logs
  FOR ALL USING (
    migration_id IN (SELECT id FROM migrations WHERE user_id = auth.uid())
  );

-- ── UPDATED_AT TRIGGER ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

CREATE TRIGGER update_migrations_updated_at
  BEFORE UPDATE ON migrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
