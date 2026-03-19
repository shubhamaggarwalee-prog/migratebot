/**
 * backend/services/supabase.js
 *
 * Supabase Management API service.
 * Handles project provisioning, health polling until ACTIVE_HEALTHY,
 * SQL migration execution, auth configuration, and secrets/env vars.
 *
 * Management API reference: https://supabase.com/docs/reference/api
 */

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

const SUPABASE_MGMT_URL = 'https://api.supabase.com/v1';

// Project health states
const STATE_HEALTHY  = 'ACTIVE_HEALTHY';
const STATE_INACTIVE = 'INACTIVE';
const STATES_FAIL    = ['REMOVED', 'RESTORE_FAILED', 'UNKNOWN'];

class SupabaseService {
  /**
   * @param {string} token - Supabase personal access token (Management API)
   */
  constructor(token) {
    if (!token) throw new Error('Supabase Management API token is required');
    this.token = token;
    this.client = axios.create({
      baseURL: SUPABASE_MGMT_URL,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // ─── INTERNAL HELPER ───────────────────────────────────────────────────────

  async _request(method, path, data = null) {
    try {
      const res = await this.client.request({
        method,
        url: path,
        ...(data ? { data } : {}),
      });
      return res.data;
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error  ||
        err.message;
      const status = err.response?.status;
      const e = new Error(`Supabase API error${status ? ` (${status})` : ''}: ${msg}`);
      e.status = status;
      throw e;
    }
  }

  // ─── TOKEN VALIDATION ─────────────────────────────────────────────────────

  /**
   * Confirm the token works by listing organisations.
   * @returns {boolean}
   */
  async validateToken() {
    try {
      const data = await this._request('GET', '/organizations');
      return Array.isArray(data);
    } catch {
      return false;
    }
  }

  // ─── ORGANISATIONS ───────────────────────────────────────────────────────

  /**
   * List all organisations the token has access to.
   * @returns {Array<{ id, name }>}
   */
  async getOrganizations() {
    return this._request('GET', '/organizations');
  }

  // ─── PROJECTS ─────────────────────────────────────────────────────────────

  /**
   * Create a new Supabase project.
   *
   * @param {object} opts
   * @param {string}  opts.name           - Project display name
   * @param {string}  opts.orgId          - Organisation ID to create the project in
   * @param {string}  opts.dbPassword     - Database password (min 16 chars recommended)
   * @param {string}  [opts.region]       - AWS region slug, e.g. 'us-east-1' (default: 'us-east-1')
   * @param {string}  [opts.plan]         - 'free' | 'pro' (default: 'free')
   * @returns {{
   *   id: string,
   *   projectUrl: string,
   *   anonKey: string,
   *   serviceKey: string,
   *   dbUrl: string,
   *   region: string
   * }}
   */
  async createProject({ name, orgId, dbPassword, region = 'us-east-1', plan = 'free' }) {
    logger.info(`Creating Supabase project: ${name} in org ${orgId}`);
    const data = await this._request('POST', '/projects', {
      name,
      organization_id: orgId,
      db_pass: dbPassword,
      region,
      plan,
    });
    logger.info(`Supabase project created: ${data.id} (status: ${data.status})`);
    return {
      id:          data.id,
      projectUrl:  `https://${data.id}.supabase.co`,
      anonKey:     data.anon_key,
      serviceKey:  data.service_role_key,
      dbUrl:       `postgresql://postgres:${dbPassword}@db.${data.id}.supabase.co:5432/postgres`,
      region:      data.region,
    };
  }

  /**
   * List all projects for the authenticated user.
   * @returns {Array}
   */
  async getProjects() {
    return this._request('GET', '/projects');
  }

  /**
   * Get a single project by ID.
   * @param {string} projectId
   * @returns {object} Raw Supabase project object (includes `status`)
   */
  async getProject(projectId) {
    return this._request('GET', `/projects/${projectId}`);
  }

  /**
   * Poll until the project status becomes ACTIVE_HEALTHY.
   *
   * Supabase project status lifecycle:
   *   COMING_UP → ACTIVE_HEALTHY
   *   INACTIVE  (paused free-tier project)
   *   RESTORE_FAILED / REMOVED / UNKNOWN  (terminal failures)
   *
   * @param {string} projectId
   * @param {number} [maxWaitMs=120000]  - 2-minute default; provisioning usually takes 20–60s
   * @returns {object} Full project object once healthy
   * @throws Error on failure or timeout
   */
  async waitForProject(projectId, maxWaitMs = 120_000) {
    const start = Date.now();
    logger.info(`Waiting for Supabase project ${projectId} to become ${STATE_HEALTHY}...`);

    while (Date.now() - start < maxWaitMs) {
      const project = await this.getProject(projectId);
      logger.info(`Supabase project status: ${project.status}`);

      if (project.status === STATE_HEALTHY)  return project;
      if (project.status === STATE_INACTIVE) throw new Error('Supabase project is INACTIVE (paused)');
      if (STATES_FAIL.includes(project.status)) {
        throw new Error(`Supabase project failed with status: ${project.status}`);
      }

      await this.sleep(5000);
    }

    throw new Error(`Supabase project timed out after ${maxWaitMs / 1000}s waiting for ACTIVE_HEALTHY`);
  }

  /**
   * Retrieve the API keys (anon + service_role) for an existing project.
   * @param {string} projectId
   * @returns {{ anonKey: string, serviceKey: string }}
   */
  async getApiKeys(projectId) {
    const keys = await this._request('GET', `/projects/${projectId}/api-keys`);
    const anon    = keys.find(k => k.name === 'anon');
    const service = keys.find(k => k.name === 'service_role');
    if (!anon || !service) throw new Error('Could not find anon/service_role keys for project');
    return { anonKey: anon.api_key, serviceKey: service.api_key };
  }

  // ─── DATABASE / SQL MIGRATIONS ───────────────────────────────────────────────

  /**
   * Run a SQL string against a project via the Management API.
   * Use this for schema migrations, DDL, and RLS policy creation.
   *
   * @param {string} projectId
   * @param {string} sql  - Full SQL string (may contain multiple statements)
   * @returns {object} Query result
   */
  async runMigration(projectId, sql) {
    logger.info(`Running SQL migration on Supabase project ${projectId}`);
    return this._request('POST', `/projects/${projectId}/database/query`, { query: sql });
  }

  /**
   * Run a SQL string using the Supabase JS client's RPC exec_sql.
   * Preferred when you already have projectUrl + serviceKey.
   * Falls back to statement-by-statement execution if RPC is unavailable.
   *
   * @param {string} projectUrl  - e.g. https://xxxx.supabase.co
   * @param {string} serviceKey  - service_role JWT
   * @param {string} sql
   */
  async runMigrationWithClient(projectUrl, serviceKey, sql) {
    const client = createClient(projectUrl, serviceKey);

    // Try bulk exec first
    const { error } = await client.rpc('exec_sql', { sql }).catch(() => ({ error: new Error('exec_sql unavailable') }));
    if (!error) return;

    // Fallback: split on semicolons and run each statement individually
    logger.info('exec_sql RPC unavailable, falling back to per-statement execution');
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      const { error: stmtErr } = await client.rpc('exec_sql', { sql: stmt + ';' });
      if (stmtErr) throw new Error(`Migration statement failed: ${stmtErr.message}\nStatement: ${stmt}`);
    }
  }

  /**
   * Run multiple SQL migration files in order.
   * Each entry is a { name, sql } object.
   *
   * @param {string} projectId
   * @param {Array<{ name: string, sql: string }>} migrations
   */
  async runMigrations(projectId, migrations) {
    logger.info(`Running ${migrations.length} SQL migration(s) on project ${projectId}`);
    for (const { name, sql } of migrations) {
      logger.info(`  → Migration: ${name}`);
      await this.runMigration(projectId, sql);
    }
    logger.info('All SQL migrations complete');
  }

  // ─── AUTH CONFIGURATION ─────────────────────────────────────────────────────

  /**
   * Configure auth settings for a project.
   *
   * @param {string} projectId
   * @param {object} settings
   * @param {string}   settings.siteUrl          - Primary redirect URL (your frontend origin)
   * @param {string[]} [settings.redirectUrls]   - Allowed OAuth redirect URLs
   * @param {number}   [settings.jwtExpiry]      - JWT expiry in seconds (default 3600)
   * @param {boolean}  [settings.enableSignup]   - Allow new sign-ups (default true)
   * @param {string}   [settings.googleClientId]    - Google OAuth client ID
   * @param {string}   [settings.googleSecret]      - Google OAuth secret
   * @param {string}   [settings.githubClientId]    - GitHub OAuth App client ID
   * @param {string}   [settings.githubSecret]      - GitHub OAuth App secret
   * @returns {object} Updated auth config
   */
  async configureAuth(projectId, settings) {
    logger.info(`Configuring auth for Supabase project ${projectId}`);
    const body = {
      site_url:                  settings.siteUrl,
      additional_redirect_urls:  settings.redirectUrls   || [],
      jwt_expiry:                settings.jwtExpiry      || 3600,
      enable_signup:             settings.enableSignup   !== false,
      external_email_enabled:    true,
      // Google OAuth
      external_google_enabled:   !!settings.googleClientId,
      ...(settings.googleClientId ? {
        external_google_client_id: settings.googleClientId,
        external_google_secret:    settings.googleSecret,
      } : {}),
      // GitHub OAuth
      external_github_enabled:   !!settings.githubClientId,
      ...(settings.githubClientId ? {
        external_github_client_id: settings.githubClientId,
        external_github_secret:    settings.githubSecret,
      } : {}),
    };
    return this._request('PATCH', `/projects/${projectId}/config/auth`, body);
  }

  /**
   * Get the current auth configuration for a project.
   * @param {string} projectId
   * @returns {object}
   */
  async getAuthConfig(projectId) {
    return this._request('GET', `/projects/${projectId}/config/auth`);
  }

  // ─── SECRETS / ENV VARS ─────────────────────────────────────────────────────

  /**
   * List all secrets (env vars) for an Edge Function environment.
   * @param {string} projectId
   * @returns {Array<{ name, value }>}
   */
  async getSecrets(projectId) {
    return this._request('GET', `/projects/${projectId}/secrets`);
  }

  /**
   * Upsert secrets (Edge Function env vars) for a project.
   * Each secret is a { name, value } object.
   *
   * @param {string}                      projectId
   * @param {Array<{ name, value }>}      secrets
   */
  async setSecrets(projectId, secrets) {
    logger.info(`Setting ${secrets.length} secret(s) on Supabase project ${projectId}`);
    return this._request('POST', `/projects/${projectId}/secrets`, secrets);
  }

  /**
   * Upsert secrets from a plain key/value map (convenience wrapper).
   * @param {string}                   projectId
   * @param {Record<string, string>}   secretsMap
   */
  async setSecretsFromMap(projectId, secretsMap) {
    const secrets = Object.entries(secretsMap).map(([name, value]) => ({ name, value }));
    return this.setSecrets(projectId, secrets);
  }

  /**
   * Delete secrets by name.
   * @param {string}   projectId
   * @param {string[]} names
   */
  async deleteSecrets(projectId, names) {
    return this._request('DELETE', `/projects/${projectId}/secrets`, names);
  }

  // ─── SEED DATA ─────────────────────────────────────────────────────────────

  /**
   * Bulk-insert rows into a table via the Supabase JS client.
   * Processes in batches to avoid request size limits.
   *
   * @param {string}  projectUrl
   * @param {string}  serviceKey
   * @param {string}  tableName
   * @param {Array}   rows
   * @param {number}  [batchSize=100]
   * @returns {number} Total rows inserted
   */
  async seedTable(projectUrl, serviceKey, tableName, rows, batchSize = 100) {
    const client = createClient(projectUrl, serviceKey);
    let inserted = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error, count } = await client
        .from(tableName)
        .insert(batch)
        .select('count');
      if (error) throw new Error(`Seed failed for ${tableName}: ${error.message}`);
      inserted += count || batch.length;
    }
    logger.info(`Seeded ${inserted} rows into ${tableName}`);
    return inserted;
  }

  // ─── UTILS ────────────────────────────────────────────────────────────────

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = SupabaseService;
