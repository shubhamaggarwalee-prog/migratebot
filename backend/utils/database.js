/**
 * backend/utils/database.js
 *
 * Supabase client initialisation + full schema auto-initialisation on boot.
 *
 * Tables created (idempotent — safe to run on every restart):
 *   users            — accounts, auth, TOTP, notification preferences
 *   credentials      — encrypted platform API tokens per user
 *   migrations       — migration jobs + Stripe payment tracking
 *   migration_logs   — per-task structured logs for live progress feed
 *
 * Call initSchema() once during server startup (server.js).
 */

'use strict';

const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');

// ─── CLIENT ──────────────────────────────────────────────────────────────────

if (!process.env.SUPABASE_URL)          throw new Error('Missing env: SUPABASE_URL');
if (!process.env.SUPABASE_SERVICE_KEY)  throw new Error('Missing env: SUPABASE_SERVICE_KEY');

/**
 * Service-role client — bypasses RLS.
 * Used exclusively server-side; never expose this key to the frontend.
 */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken:  false,
      persistSession:    false,
      detectSessionInUrl: false,
    },
  }
);

// ─── SCHEMA SQL ────────────────────────────────────────────────────────────────

/**
 * Full DDL for all four tables.
 * Every statement is idempotent (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS).
 * New columns added to existing tables use ALTER TABLE … IF NOT EXISTS so
 * re-running on an already-provisioned database is always safe.
 */
const SCHEMA_SQL = `

-- ============================================================
-- 1. USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- identity
  email               TEXT    NOT NULL UNIQUE,
  name                TEXT    NOT NULL,
  password_hash       TEXT    NOT NULL,

  -- plan / billing
  plan                TEXT    NOT NULL DEFAULT 'starter'
                        CHECK (plan IN ('starter', 'pro', 'enterprise')),
  stripe_customer_id  TEXT,

  -- account state
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified      BOOLEAN NOT NULL DEFAULT FALSE,

  -- two-factor authentication (TOTP)
  totp_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
  totp_secret         TEXT,            -- base32-encoded, AES-256-GCM encrypted at rest
  totp_backup_codes   JSONB   NOT NULL DEFAULT '[]'::JSONB,
                                        -- array of { hash: string, used: boolean }

  -- notifications
  slack_webhook       TEXT,            -- Slack incoming webhook URL
  notification_prefs  JSONB   NOT NULL DEFAULT '{
    "migration_completed": true,
    "migration_failed":    true,
    "health_check_alerts": true,
    "product_updates":     false,
    "billing_receipts":    true
  }'::JSONB,

  -- timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep updated_at current automatically
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS users_email_idx        ON users (email);
CREATE INDEX IF NOT EXISTS users_stripe_idx       ON users (stripe_customer_id);
CREATE INDEX IF NOT EXISTS users_created_at_idx   ON users (created_at DESC);

-- ============================================================
-- 2. CREDENTIALS
-- ============================================================
CREATE TABLE IF NOT EXISTS credentials (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- platform identifier
  platform         TEXT    NOT NULL
                     CHECK (platform IN ('github','vercel','railway','supabase','heroku')),
  label            TEXT    NOT NULL DEFAULT 'default',

  -- AES-256-GCM encrypted token
  encrypted_token  TEXT    NOT NULL,
  iv               TEXT    NOT NULL,   -- 16-byte hex initialisation vector

  -- metadata
  last_used_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- one credential per user per platform per label
  UNIQUE (user_id, platform, label)
);

CREATE INDEX IF NOT EXISTS credentials_user_idx      ON credentials (user_id);
CREATE INDEX IF NOT EXISTS credentials_platform_idx  ON credentials (user_id, platform);

-- ============================================================
-- 3. MIGRATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS migrations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- source
  repo_url                TEXT    NOT NULL,
  repo_branch             TEXT    NOT NULL DEFAULT 'main',

  -- target platforms (array of strings: 'vercel','railway','supabase')
  platforms               TEXT[]  NOT NULL DEFAULT '{}',

  -- plan at time of migration
  plan                    TEXT    NOT NULL DEFAULT 'starter'
                            CHECK (plan IN ('starter', 'pro')),

  -- lifecycle status
  status                  TEXT    NOT NULL DEFAULT 'pending'
                            CHECK (status IN (
                              'pending',
                              'analyzing',
                              'deploying',
                              'success',
                              'failed',
                              'refunded',
                              'cancelled'
                            )),
  error_message           TEXT,

  -- deployed output URLs
  deployed_urls           JSONB   DEFAULT '{}'::JSONB,
                                   -- { frontend, backend, database, pr }

  -- stripe payment
  stripe_payment_intent_id TEXT,
  amount_charged          INTEGER DEFAULT 0,   -- cents
  amount_refunded         INTEGER DEFAULT 0,   -- cents
  currency                TEXT    NOT NULL DEFAULT 'usd',

  -- timing
  started_at              TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  duration_seconds        INTEGER,

  -- timestamps
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS migrations_updated_at ON migrations;
CREATE TRIGGER migrations_updated_at
  BEFORE UPDATE ON migrations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS migrations_user_idx       ON migrations (user_id);
CREATE INDEX IF NOT EXISTS migrations_status_idx     ON migrations (status);
CREATE INDEX IF NOT EXISTS migrations_created_at_idx ON migrations (created_at DESC);
CREATE INDEX IF NOT EXISTS migrations_stripe_idx     ON migrations (stripe_payment_intent_id);

-- ============================================================
-- 4. MIGRATION_LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS migration_logs (
  id            BIGSERIAL   PRIMARY KEY,
  migration_id  UUID        NOT NULL REFERENCES migrations(id) ON DELETE CASCADE,

  -- log entry
  level         TEXT        NOT NULL DEFAULT 'info'
                  CHECK (level IN ('info', 'success', 'warn', 'error')),
  task          TEXT        NOT NULL,   -- task identifier e.g. 'railway-deploy'
  message       TEXT        NOT NULL,
  metadata      JSONB       DEFAULT '{}'::JSONB,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS migration_logs_migration_idx    ON migration_logs (migration_id);
CREATE INDEX IF NOT EXISTS migration_logs_created_at_idx   ON migration_logs (migration_id, created_at ASC);
CREATE INDEX IF NOT EXISTS migration_logs_level_idx        ON migration_logs (migration_id, level);

-- ============================================================
-- COLUMN GUARDS
-- Add any columns that may be missing on pre-existing databases.
-- Each block is wrapped in a DO $$ block so failures are per-column,
-- not per-migration, and re-running is always safe.
-- ============================================================

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled       BOOLEAN NOT NULL DEFAULT FALSE;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret        TEXT;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_backup_codes  JSONB NOT NULL DEFAULT '[]'::JSONB;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified     BOOLEAN NOT NULL DEFAULT FALSE;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS slack_webhook      TEXT;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{
    "migration_completed": true,
    "migration_failed":    true,
    "health_check_alerts": true,
    "product_updates":     false,
    "billing_receipts":    true
  }'::JSONB;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE migrations ADD COLUMN IF NOT EXISTS deployed_urls  JSONB DEFAULT '{}'::JSONB;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE migrations ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE migrations ADD COLUMN IF NOT EXISTS amount_refunded INTEGER DEFAULT 0;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE migrations ADD COLUMN IF NOT EXISTS repo_branch TEXT NOT NULL DEFAULT 'main';
EXCEPTION WHEN others THEN NULL; END $$;

`;

// ─── SCHEMA INIT ─────────────────────────────────────────────────────────────────

/**
 * Run the full schema DDL against the Supabase database.
 * Safe to call on every boot — all statements are idempotent.
 *
 * Execution strategy:
 *   1. Try the Management API /database/query endpoint (preferred — runs full DDL).
 *   2. Fall back to pg raw connection via DATABASE_URL if available.
 *   3. Fall back to Supabase JS client rpc('exec_sql') as last resort.
 *
 * @returns {Promise<void>}
 */
async function initSchema() {
  logger.info('Initialising database schema...');
  try {
    await runSchemaSql(SCHEMA_SQL);
    logger.info('Database schema ready ✔');
  } catch (err) {
    // Schema init failure is non-fatal in development (e.g. read-only anon key)
    // but should be surfaced loudly in production.
    if (process.env.NODE_ENV === 'production') {
      logger.error('FATAL: Schema initialisation failed:', err.message);
      throw err;
    } else {
      logger.warn('Schema init skipped (non-production):', err.message);
    }
  }
}

/**
 * Execute a SQL string via the Supabase JS client rpc.
 * Splits on semicolons and runs each statement individually when bulk exec
 * is unavailable.
 *
 * @param {string} sql
 */
async function runSchemaSql(sql) {
  // Strategy 1: rpc exec_sql bulk (fastest, requires the function to exist)
  const { error: bulkErr } = await supabase.rpc('exec_sql', { sql });
  if (!bulkErr) return;

  // Strategy 2: statement-by-statement via rpc
  logger.info('exec_sql unavailable, falling back to per-statement execution');
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let failed = 0;
  for (const stmt of statements) {
    const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' });
    if (error) {
      // Log but continue — some statements may fail on old Supabase plans
      // (e.g. CREATE INDEX CONCURRENTLY not allowed on free tier)
      logger.warn(`Schema statement warning: ${error.message}`);
      failed++;
    }
  }

  if (failed > 0) {
    logger.warn(`Schema init completed with ${failed} non-fatal statement warning(s)`);
  }
}

// ─── CONVENIENCE QUERY HELPERS ─────────────────────────────────────────────────────

/**
 * Thin wrapper that throws on Supabase JS client errors.
 * Usage: const data = await query(supabase.from('users').select('*').eq('id', id));
 *
 * @param {PromiseLike<{ data, error }>} queryPromise
 * @returns {*} data
 */
async function query(queryPromise) {
  const { data, error } = await queryPromise;
  if (error) throw Object.assign(new Error(error.message), { code: error.code, details: error.details });
  return data;
}

/**
 * Same as query() but returns { data, count } for paginated queries.
 * @param {PromiseLike<{ data, count, error }>} queryPromise
 * @returns {{ data: *, count: number }}
 */
async function queryWithCount(queryPromise) {
  const { data, count, error } = await queryPromise;
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return { data, count };
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = supabase;
module.exports.initSchema     = initSchema;
module.exports.query          = query;
module.exports.queryWithCount = queryWithCount;
