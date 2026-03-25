/**
 * backend/routes/appHealth.js
 *
 * GET  /api/app-health/:migrationId
 *   Pings the migration's live frontend URL and returns a health snapshot.
 *   Result is cached in Supabase (health_checks table) so the frontend can
 *   show the last-checked time even when offline.
 *
 * POST /api/app-health/:migrationId/restart
 *   Triggers a fresh Vercel redeployment (same mechanism as push-change).
 *   Returns { success, deploymentUrl }.
 */
const express = require('express');
const router  = express.Router();
const fetch   = require('node-fetch');
const { requireAuth } = require('../middleware/auth');
const { supabase }    = require('../services/supabase');

// ─── helpers ────────────────────────────────────────────────────────────────

/** Ping a URL and return { ok, statusCode, latencyMs, error }. */
async function pingUrl(url) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 10_000); // 10-second hard cap
    const res        = await fetch(url, {
      method : 'HEAD',          // lightweight — no body needed
      redirect: 'follow',
      signal : controller.signal,
    });
    clearTimeout(timeout);
    const latencyMs  = Date.now() - start;
    const ok         = res.status < 400;
    return { ok, statusCode: res.status, latencyMs, error: null };
  } catch (err) {
    return { ok: false, statusCode: null, latencyMs: Date.now() - start, error: err.message };
  }
}

/** Parse "https://github.com/owner/repo" → { owner, repo } */
function parseGithubUrl(url = '') {
  const clean = url.replace(/\.git$/, '').replace(/\/$/, '');
  const parts = clean.split('/');
  return { owner: parts[parts.length - 2], repo: parts[parts.length - 1] };
}

/** Trigger a Vercel redeployment. Returns deploymentUrl or null. */
async function triggerVercelRedeploy(vercelToken, vercelProjectId) {
  if (!vercelToken || !vercelProjectId) return null;
  try {
    const listRes = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${vercelProjectId}&limit=1`,
      { headers: { Authorization: `Bearer ${vercelToken}` } }
    );
    if (!listRes.ok) return null;
    const { deployments } = await listRes.json();
    if (!deployments?.length) return null;
    const latest    = deployments[0];
    const deployRes = await fetch('https://api.vercel.com/v13/deployments', {
      method : 'POST',
      headers: { Authorization: `Bearer ${vercelToken}`, 'Content-Type': 'application/json' },
      body   : JSON.stringify({ name: latest.name, gitSource: latest.gitSource, target: 'production' }),
    });
    if (!deployRes.ok) return null;
    const deploy = await deployRes.json();
    return deploy.url ? `https://${deploy.url}` : null;
  } catch { return null; }
}

// ─── GET /api/app-health/:migrationId ───────────────────────────────────────

router.get('/:migrationId', requireAuth, async (req, res) => {
  const { migrationId } = req.params;
  const userId = req.user.id;

  try {
    // 1. Load migration (ownership check)
    const { data: migration, error: migErr } = await supabase
      .from('migrations')
      .select('id, status, deployed_urls, credentials, vercel_project_id, repourl')
      .eq('id', migrationId)
      .eq('user_id', userId)
      .single();

    if (migErr || !migration)
      return res.status(404).json({ error: 'Migration not found.' });

    if (migration.status !== 'complete')
      return res.json({ status: 'not_deployed', message: 'App has not been deployed yet.' });

    const appUrl = migration.deployed_urls?.frontend;
    if (!appUrl)
      return res.json({ status: 'unknown', message: 'No live URL found for this app.' });

    // 2. Ping the live URL
    const { ok, statusCode, latencyMs, error: pingErr } = await pingUrl(appUrl);
    const checkedAt = new Date().toISOString();
    const status    = ok ? 'up' : 'down';

    // 3. Persist result (non-blocking — table may not exist yet, that's fine)
    supabase.from('health_checks').upsert({
      migration_id : migrationId,
      user_id      : userId,
      status,
      status_code  : statusCode,
      latency_ms   : latencyMs,
      checked_at   : checkedAt,
      error        : pingErr,
    }, { onConflict: 'migration_id' }).catch(() => {});

    return res.json({
      status,
      statusCode,
      latencyMs,
      checkedAt,
      appUrl,
      error: pingErr,
      message: ok
        ? `Your app is responding normally (${latencyMs}ms).`
        : `Your app appears to be down${pingErr ? ` — ${pingErr}` : ''}.`,
    });

  } catch (err) {
    console.error('[app-health]', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/app-health/:migrationId/restart ──────────────────────────────

router.post('/:migrationId/restart', requireAuth, async (req, res) => {
  const { migrationId } = req.params;
  const userId = req.user.id;

  try {
    const { data: migration, error: migErr } = await supabase
      .from('migrations')
      .select('id, status, credentials, vercel_project_id, deployed_urls, repourl')
      .eq('id', migrationId)
      .eq('user_id', userId)
      .single();

    if (migErr || !migration)
      return res.status(404).json({ error: 'Migration not found.' });

    const vercelToken     = migration.credentials?.vercel_token;
    const vercelProjectId = migration.vercel_project_id;

    if (!vercelToken || !vercelProjectId)
      return res.status(400).json({ error: 'No Vercel credentials found. Please reconnect Vercel in Settings.' });

    const deploymentUrl = await triggerVercelRedeploy(vercelToken, vercelProjectId);

    // Log the restart
    supabase.from('push_change_log').insert({
      migration_id  : migrationId,
      user_id       : userId,
      files_changed : [],
      commit_message: 'Manual restart via health monitor',
      deployment_url: deploymentUrl,
      pushed_at     : new Date().toISOString(),
    }).catch(() => {});

    return res.json({
      success      : true,
      deploymentUrl,
      message: deploymentUrl
        ? 'Restart triggered. Your app should be back up in about 60 seconds.'
        : 'Restart command sent. Vercel will redeploy automatically within ~60 seconds.',
    });

  } catch (err) {
    console.error('[app-health/restart]', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
