/**
 * backend/routes/pushChange.js
 *
 * POST /api/push-change/:migrationId
 * Accepts { files: [{ path, content }], commitMessage } in the request body.
 * 1. Looks up the migration to get the connected GitHub repo + user's Vercel token.
 * 2. For each file, calls the GitHub Contents API to create or update the file
 *    (auto-fetches the existing blob SHA so updates work correctly).
 * 3. Triggers a Vercel redeployment by calling the Vercel API.
 * 4. Returns { success, deploymentUrl } back to the frontend.
 */
const express  = require('express');
const router   = express.Router();
const fetch    = require('node-fetch');
const { requireAuth } = require('../middleware/auth');
const { supabase }    = require('../services/supabase');

// ─── helpers ────────────────────────────────────────────────────────────────

/** Convert plain text → base64 (Node-safe, handles unicode) */
function toBase64(str) {
  return Buffer.from(str, 'utf8').toString('base64');
}

/** Parse   "https://github.com/owner/repo"  →  { owner, repo } */
function parseGithubUrl(url = '') {
  const clean = url.replace(/\.git$/, '').replace(/\/$/, '');
  const parts = clean.split('/');
  return { owner: parts[parts.length - 2], repo: parts[parts.length - 1] };
}

/**
 * Get the current blob SHA for a file (needed to update existing files).
 * Returns null if the file does not yet exist (new file creation).
 */
async function getFileSha(owner, repo, filePath, githubToken) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
    { headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json' } }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub contents fetch failed: ${res.status}`);
  const data = await res.json();
  return data.sha || null;
}

/**
 * Create or update a single file in the GitHub repo via the Contents API.
 */
async function upsertFile(owner, repo, filePath, content, message, githubToken) {
  const sha  = await getFileSha(owner, repo, filePath, githubToken);
  const body = { message, content: toBase64(content) };
  if (sha) body.sha = sha;          // required for updates, omit for new files

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
    {
      method : 'PUT',
      headers: {
        Authorization : `Bearer ${githubToken}`,
        Accept        : 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub upsert failed for ${filePath}: ${err}`);
  }
  return res.json();
}

/**
 * Trigger a Vercel redeployment for the project linked to this migration.
 * Uses the Vercel deployments API — creates a new deployment from the latest git commit.
 */
async function triggerVercelRedeploy(vercelToken, vercelProjectId) {
  if (!vercelToken || !vercelProjectId) return null;

  // Get the latest deployment for this project to clone
  const listRes = await fetch(
    `https://api.vercel.com/v6/deployments?projectId=${vercelProjectId}&limit=1`,
    { headers: { Authorization: `Bearer ${vercelToken}` } }
  );
  if (!listRes.ok) return null;
  const { deployments } = await listRes.json();
  if (!deployments || deployments.length === 0) return null;

  const latest = deployments[0];

  // Redeploy by POSTing to /v13/deployments with the same gitSource
  const deployRes = await fetch('https://api.vercel.com/v13/deployments', {
    method : 'POST',
    headers: {
      Authorization : `Bearer ${vercelToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name     : latest.name,
      gitSource: latest.gitSource,
      target   : 'production',
    }),
  });
  if (!deployRes.ok) return null;
  const deploy = await deployRes.json();
  return deploy.url ? `https://${deploy.url}` : null;
}

// ─── route ──────────────────────────────────────────────────────────────────

router.post('/:migrationId', requireAuth, async (req, res) => {
  const { migrationId } = req.params;
  const { files = [], commitMessage } = req.body;
  const userId = req.user.id;

  // Validate
  if (!files.length) {
    return res.status(400).json({ error: 'No files provided.' });
  }
  for (const f of files) {
    if (!f.path || typeof f.content !== 'string') {
      return res.status(400).json({ error: 'Each file needs a path and content string.' });
    }
  }

  try {
    // 1. Load migration + verify ownership
    const { data: migration, error: migErr } = await supabase
      .from('migrations')
      .select('*')
      .eq('id', migrationId)
      .eq('user_id', userId)
      .single();

    if (migErr || !migration) {
      return res.status(404).json({ error: 'Migration not found.' });
    }
    if (migration.status !== 'complete') {
      return res.status(400).json({ error: 'You can only push changes to a completed migration.' });
    }

    // 2. Get credentials (GitHub PAT + Vercel token) from the migration record
    const githubToken      = migration.credentials?.github_token;
    const vercelToken      = migration.credentials?.vercel_token;
    const vercelProjectId  = migration.vercel_project_id;
    const repoUrl          = migration.repourl;

    if (!githubToken || !repoUrl) {
      return res.status(400).json({ error: 'No GitHub credentials found for this migration. Please reconnect your GitHub account in Settings.' });
    }

    const { owner, repo } = parseGithubUrl(repoUrl);
    const message = commitMessage?.trim() || `Update via MigrateBot — ${new Date().toISOString()}`;

    // 3. Commit each file to GitHub
    const commitResults = [];
    for (const file of files) {
      const result = await upsertFile(owner, repo, file.path, file.content, message, githubToken);
      commitResults.push({ path: file.path, sha: result?.content?.sha });
    }

    // 4. Trigger Vercel redeploy (best-effort — don't fail if Vercel errors)
    let deploymentUrl = null;
    try {
      deploymentUrl = await triggerVercelRedeploy(vercelToken, vercelProjectId);
    } catch (_) {
      // Vercel redeploy is best-effort; auto-deploy from GitHub will also fire
    }

    // 5. Log the push to the migration's history
    await supabase.from('push_change_log').insert({
      migration_id : migrationId,
      user_id      : userId,
      files_changed: files.map(f => f.path),
      commit_message: message,
      deployment_url: deploymentUrl,
      pushed_at    : new Date().toISOString(),
    }).catch(() => {}); // non-blocking — table may not exist yet

    return res.json({
      success       : true,
      filesCommitted: commitResults.length,
      commitMessage : message,
      deploymentUrl,
      repoUrl       : `https://github.com/${owner}/${repo}`,
      message       : deploymentUrl
        ? 'Your changes are committed and a redeployment has started. Your live app will update in about 60 seconds.'
        : 'Your changes are committed to GitHub. Vercel will auto-detect and redeploy within ~60 seconds.',
    });

  } catch (err) {
    console.error('[push-change]', err);
    return res.status(500).json({ error: err.message || 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
