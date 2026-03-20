/**
 * backend/utils/database.js
 *
 * Supabase client initialisation + full schema auto-initialisation on boot.
 */

'use strict';

const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');

// Support both names — prefer SUPABASE_SERVICE_ROLE_KEY, fall back to SUPABASE_SERVICE_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!process.env.SUPABASE_URL) throw new Error('Missing env: SUPABASE_URL');
if (!SERVICE_KEY) throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(
  process.env.SUPABASE_URL,
  SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
);

// ─── SCHEMA SQL ──────────────────────────────────────────────────────────────

const SCHEMA_SQL = `

CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT    NOT NULL UNIQUE,
  name                TEXT    NOT NULL,
  password_hash       TEXT    NOT NULL,
  plan                TEXT    NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'enterprise')),
  stripe_customer_id  TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  totp_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
  totp_secret         TEXT,
  totp_backup_codes   JSONB   NOT NULL DEFAULT '[]'::JSONB,
  slack_webhook       TEXT,
  notification_prefs  JSONB   NOT NULL DEFAULT '{"migration_completed":true,"migration_failed":true,"health_check_alerts":true,"product_updates":false,"billing_receipts":true}'::JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS users_email_idx      ON users (email);
CREATE INDEX IF NOT EXISTS users_stripe_idx     ON users (stripe_customer_id);
CREATE INDEX IF NOT EXISTS users_created_at_idx ON users (created_at DESC);

CREATE TABLE IF NOT EXISTS credentials (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform         TEXT    NOT NULL CHECK (platform IN ('github','vercel','railway','supabase','heroku')),
  label            TEXT    NOT NULL DEFAULT 'default',
  encrypted_token  TEXT    NOT NULL,
  iv               TEXT    NOT NULL,
  last_used_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, platform, label)
);

CREATE INDEX IF NOT EXISTS credentials_user_idx     ON credentials (user_id);
CREATE INDEX IF NOT EXISTS credentials_platform_idx ON credentials (user_id, platform);

CREATE TABLE IF NOT EXISTS migrations (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo_url                 TEXT    NOT NULL,
  repo_branch              TEXT    NOT NULL DEFAULT 'main',
  platforms                TEXT[]  NOT NULL DEFAULT '{}',
  plan                     TEXT    NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro')),
  status                   TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','analyzing','deploying','success','failed','refunded','cancelled')),
  error_message            TEXT,
  deployed_urls            JSONB   DEFAULT '{}'::JSONB,
  stripe_payment_intent_id TEXT,
  amount_charged           INTEGER DEFAULT 0,
  amount_refunded          INTEGER DEFAULT 0,
  currency                 TEXT    NOT NULL DEFAULT 'usd',
  started_at               TIMESTAMPTZ,
  completed_at             TIMESTAMPTZ,
  duration_seconds         INTEGER,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS migrations_updated_at ON migrations;
CREATE TRIGGER migrations_updated_at BEFORE UPDATE ON migrations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS migrations_user_idx       ON migrations (user_id);
CREATE INDEX IF NOT EXISTS migrations_status_idx     ON migrations (status);
CREATE INDEX IF NOT EXISTS migrations_created_at_idx ON migrations (created_at DESC);
CREATE INDEX IF NOT EXISTS migrations_stripe_idx     ON migrations (stripe_payment_intent_id);

CREATE TABLE IF NOT EXISTS migration_logs (
  id            BIGSERIAL   PRIMARY KEY,
  migration_id  UUID        NOT NULL REFERENCES migrations(id) ON DELETE CASCADE,
  level         TEXT        NOT NULL DEFAULT 'info' CHECK (level IN ('info','success','warn','error')),
  task          TEXT        NOT NULL,
  message       TEXT        NOT NULL,
  metadata      JSONB       DEFAULT '{}'::JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS migration_logs_migration_idx  ON migration_logs (migration_id);
CREATE INDEX IF NOT EXISTS migration_logs_created_at_idx ON migration_logs (migration_id, created_at ASC);
CREATE INDEX IF NOT EXISTS migration_logs_level_idx      ON migration_logs (migration_id, level);

`;

// ─── SCHEMA INIT ─────────────────────────────────────────────────────────────

async function initSchema() {
  logger.info('Initialising database schema...');
  try {
    await runSchemaSql(SCHEMA_SQL);
    logger.info('Database schema ready ✔');
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('FATAL: Schema initialisation failed:', err.message);
      throw err;
    } else {
      logger.warn('Schema init skipped (non-production):', err.message);
    }
  }
}

async function runSchemaSql(sql) {
  const { error: bulkErr } = await supabase.rpc('exec_sql', { sql });
  if (!bulkErr) return;

  logger.info('exec_sql unavailable, falling back to per-statement execution');
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));

  let failed = 0;
  for (const stmt of statements) {
    const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' });
    if (error) { logger.warn(`Schema statement warning: ${error.message}`); failed++; }
  }
  if (failed > 0) logger.warn(`Schema init completed with ${failed} non-fatal statement warning(s)`);
}

// ─── QUERY HELPERS ───────────────────────────────────────────────────────────

async function query(queryPromise) {
  const { data, error } = await queryPromise;
  if (error) throw Object.assign(new Error(error.message), { code: error.code, details: error.details });
  return data;
}

async function queryWithCount(queryPromise) {
  const { data, count, error } = await queryPromise;
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return { data, count };
}

module.exports = supabase;
module.exports.initSchema     = initSchema;
module.exports.query          = query;
module.exports.queryWithCount = queryWithCount;
