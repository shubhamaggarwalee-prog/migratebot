/**
 * backend/routes/updateDeploy.js
 *
 * POST /api/update-deploy/:migrationId
 *
 * Extended version of push-change that:
 *  1. Accepts { files, commitMessage } (same shape as push-change).
 *  2. Diffs each incoming file against the current version in GitHub.
 *  3. Commits only the files that actually changed (or are new).
 *  4. Triggers a Vercel redeployment.
 *  5. Emits socket events so the frontend can show a live progress bar.
 *  6. Sends a completion email when the deploy finishes (or after a 90-second
 *     timeout if we can not poll Vercel status).
 *  7. Returns { success, diff, deploymentUrl, filesChanged, filesUnchanged }.
 */
const express  = require('express');
const router   = express.Router();
const fetch    = require('node-fetch');
const { requireAuth } = require('../middleware/auth');
const { supabase }    = require('../services/supabase');
const emailSvc        = require('../services/email');

// ─── helpers ────────────────────────────────────────────────────────────────

function toBase64(str)   { return Buffer.from(str, 'utf8').toString('base64'); }
function fromBase64(str) { return Buffer.from(str, 'base64').toString('utf8'); }

function parseGithubUrl(url = '') {
  const clean = url.replace(/\.git$/, '').replace(/\/$/, '');
  const parts = clean.split('/');
  return { owner: parts[parts.length - 2], repo: parts[parts.length - 1] };
}

/** Return { sha, content } for an existing file, or null if missing. */
async function getRemoteFile(owner, repo, filePath, token) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub fetch failed for ${filePath}: ${res.status}`);
  const data = await res.json();
  return { sha: data.sha, content: fromBase64(data.content.replace(/\n/g, '')) };
}

async function upsertFile(owner, repo, filePath, newContent, sha, message, token) {
  const body = { message, content: toBase64(newContent) };
  if (sha) body.sha = sha;
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
    {
      method : 'PUT',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body   : JSON.stringify(body),
    }
  );
  if (!res.ok) { const e = await res.text(); throw new Error(`GitHub upsert failed for ${filePath}: ${e}`); }
  return res.json();
}

/** Build a simple unified-style text diff for display purposes. */
function buildDiff(filePath, oldContent, newContent) {
  if (oldContent === null) return { file: filePath, type: 'added',   linesAdded: newContent.split('\n').length, linesRemoved: 0, preview: null };

  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const removed  = oldLines.filter(l => !newLines.includes(l)).length;
  const added    = newLines.filter(l => !oldLines.includes(l)).length;

  // Collect first 6 changed lines for a human-readable preview
  const preview = [];
  const maxOld = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxOld && preview.length < 6; i++) {
    if (oldLines[i] !== newLines[i]) {
      if (oldLines[i] !== undefined) preview.push({ sign: '-', text: oldLines[i].slice(0, 120) });
      if (newLines[i] !== undefined) preview.push({ sign: '+', text: newLines[i].slice(0, 120) });
    }
  }
  return { file: filePath, type: 'modified', linesAdded: added, linesRemoved: removed, preview };
}

/**
 * Trigger a Vercel redeploy — same logic as pushChange.js.
 * Returns deployment URL or null.
 */
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

/**
 * Poll Vercel until the deployment state is READY or ERROR (max 3 min).
 * Emits socket progress events throughout.
 */
async function pollUntilReady(vercelToken, deploymentUrl, io, room) {
  const deployId = deploymentUrl?.split('/').pop();
  if (!vercelToken || !deployId) return 'unknown';

  const MAX_POLLS  = 36;   // 36 × 5 s = 3 minutes
  const POLL_MS    = 5000;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, POLL_MS));
    try {
      const res = await fetch(`https://api.vercel.com/v13/deployments/${deployId}`,
        { headers: { Authorization: `Bearer ${vercelToken}` } });
      if (!res.ok) continue;
      const data  = await res.json();
      const state = data.status || data.readyState || '';
      const pct   = Math.min(60 + Math.round((i / MAX_POLLS) * 35), 95);
      io.to(room).emit('update_progress', { stage: 'deploying', pct, state });
      if (state === 'READY')  return 'ready';
      if (state === 'ERROR')  return 'error';
    } catch { /* ignore transient errors */ }
  }
  return 'timeout';
}

// ─── route ──────────────────────────────────────────────────────────────────

router.post('/:migrationId', requireAuth, async (req, res) => {
  const { migrationId } = req.params;
  const { files = [], commitMessage } = req.body;
  const userId = req.user.id;
  const io     = req.app.get('io');
  const room   = `update:${migrationId}`;

  if (!files.length) return res.status(400).json({ error: 'No files provided.' });
  for (const f of files) {
    if (!f.path || typeof f.content !== 'string')
      return res.status(400).json({ error: 'Each file needs a path and content string.' });
  }

  try {
    // 1 ─ Load migration
    io.to(room).emit('update_progress', { stage: 'loading', pct: 5, msg: 'Loading your project…' });

    const { data: migration, error: migErr } = await supabase
      .from('migrations')
      .select('*')
      .eq('id', migrationId)
      .eq('user_id', userId)
      .single();

    if (migErr || !migration) return res.status(404).json({ error: 'Migration not found.' });
    if (migration.status !== 'complete') return res.status(400).json({ error: 'You can only push changes to a completed migration.' });

    const githubToken     = migration.credentials?.github_token;
    const vercelToken     = migration.credentials?.vercel_token;
    const vercelProjectId = migration.vercel_project_id;
    const repoUrl         = migration.repourl;
    if (!githubToken || !repoUrl) return res.status(400).json({ error: 'No GitHub credentials found for this migration.' });

    const { owner, repo } = parseGithubUrl(repoUrl);
    const message = commitMessage?.trim() || `Update via MigrateBot — ${new Date().toISOString()}`;

    // 2 ─ Diff each file against current GitHub version
    io.to(room).emit('update_progress', { stage: 'diffing', pct: 20, msg: 'Comparing your changes…' });

    const diffResults     = [];
    const filesToCommit   = [];
    const filesUnchanged  = [];

    for (const file of files) {
      const remote = await getRemoteFile(owner, repo, file.path, githubToken);
      const oldContent = remote?.content ?? null;

      if (oldContent === file.content) {
        filesUnchanged.push(file.path);
        continue;   // skip — no actual change
      }
      diffResults.push(buildDiff(file.path, oldContent, file.content));
      filesToCommit.push({ ...file, sha: remote?.sha ?? null });
    }

    if (!filesToCommit.length) {
      io.to(room).emit('update_progress', { stage: 'done', pct: 100, msg: 'No changes detected — your app is already up to date!' });
      return res.json({ success: true, filesChanged: 0, filesUnchanged: filesUnchanged.length, diff: [], deploymentUrl: null, message: 'No changes detected — nothing to commit.' });
    }

    // 3 ─ Commit changed files
    io.to(room).emit('update_progress', { stage: 'committing', pct: 40, msg: `Committing ${filesToCommit.length} changed file${filesToCommit.length > 1 ? 's' : ''}…` });

    for (const file of filesToCommit) {
      await upsertFile(owner, repo, file.path, file.content, file.sha, message, githubToken);
    }

    // 4 ─ Trigger Vercel redeploy
    io.to(room).emit('update_progress', { stage: 'deploying', pct: 55, msg: 'Triggering redeployment…' });
    const deploymentUrl = await triggerVercelRedeploy(vercelToken, vercelProjectId);

    // 5 ─ Log to DB
    await supabase.from('push_change_log').insert({
      migration_id  : migrationId,
      user_id       : userId,
      files_changed : filesToCommit.map(f => f.path),
      commit_message: message,
      deployment_url: deploymentUrl,
      pushed_at     : new Date().toISOString(),
    }).catch(() => {});

    // 6 ─ Return immediately so the browser UI can show the diff and progress bar
    res.json({
      success       : true,
      filesChanged  : filesToCommit.length,
      filesUnchanged: filesUnchanged.length,
      diff          : diffResults,
      deploymentUrl,
      repoUrl       : `https://github.com/${owner}/${repo}`,
      message       : deploymentUrl
        ? `${filesToCommit.length} file${filesToCommit.length > 1 ? 's' : ''} committed and redeployment started.`
        : `${filesToCommit.length} file${filesToCommit.length > 1 ? 's' : ''} committed. Vercel will auto-deploy within ~60 seconds.`,
    });

    // 7 ─ Poll Vercel in background, then send completion email
    ;(async () => {
      const outcome = await pollUntilReady(vercelToken, deploymentUrl, io, room);
      const pct     = outcome === 'ready' ? 100 : 95;
      const msg     = outcome === 'ready' ? 'Your app is live! 🎉'
                    : outcome === 'error'  ? 'Deployment finished with errors — check your Vercel dashboard.'
                    : 'Deployment is taking longer than usual — check Vercel for status.';

      io.to(room).emit('update_progress', { stage: outcome === 'ready' ? 'done' : 'warning', pct, msg });

      // Fetch user email for notification
      const { data: userRow } = await supabase.from('users').select('email, name').eq('id', userId).single().catch(() => ({ data: null }));
      if (userRow?.email) {
        try {
          await emailSvc.sendUpdateCompleteEmail({
            to          : userRow.email,
            name        : userRow.name || 'there',
            appUrl      : deploymentUrl || `https://github.com/${owner}/${repo}`,
            filesChanged: filesToCommit.length,
            commitMsg   : message,
            outcome,
          });
        } catch (e) { console.error('[update-deploy] email error', e); }
      }
    })();

  } catch (err) {
    console.error('[update-deploy]', err);
    io.to(room).emit('update_progress', { stage: 'error', pct: 0, msg: err.message });
    if (!res.headersSent) res.status(500).json({ error: err.message || 'Something went wrong.' });
  }
});

module.exports = router;
