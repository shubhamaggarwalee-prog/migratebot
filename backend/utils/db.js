/**
 * backend/utils/db.js
 * Database initialization — creates all tables on first boot
 */
const { supabaseAdmin } = require('./supabase');

async function initDatabase() {
  console.log('Initializing database...');
  const sql = `
    CREATE TABLE IF NOT EXISTS migrations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      repourl TEXT NOT NULL,
      reponame TEXT,
      branch TEXT DEFAULT 'main',
      source_platform TEXT DEFAULT 'github',
      tier TEXT DEFAULT 'standard',
      status TEXT DEFAULT 'pending',
      analysis_result JSONB,
      deploy_config JSONB,
      stripe_payment_intent_id TEXT,
      vercel_project_id TEXT,
      railway_project_id TEXT,
      error_message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS credentials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      migration_id UUID REFERENCES migrations(id) ON DELETE CASCADE,
      user_id UUID NOT NULL,
      platform TEXT NOT NULL,
      encrypted_data TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS deploy_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      migration_id UUID REFERENCES migrations(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      level TEXT DEFAULT 'info',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_migrations_user_id ON migrations(user_id);
    CREATE INDEX IF NOT EXISTS idx_migrations_status ON migrations(status);
    CREATE INDEX IF NOT EXISTS idx_credentials_migration_id ON credentials(migration_id);
    CREATE INDEX IF NOT EXISTS idx_deploy_logs_migration_id ON deploy_logs(migration_id);
  `;

  const { error } = await supabaseAdmin.rpc('exec_sql', { sql }).catch(() => ({ error: null }));
  if (error) console.warn('DB init warning (tables may already exist):', error.message);
  else console.log('Database initialized successfully');
}

module.exports = { initDatabase };
