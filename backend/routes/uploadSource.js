/**
 * backend/routes/uploadSource.js
 *
 * POST /api/upload-source
 * Accepts { files: [{ path, content }], appName, githubToken } in the request body.
 *
 * What it does:
 * 1. Creates a new private GitHub repo named after the app under the user's account.
 * 2. Pushes every file via the GitHub Contents API in sequence.
 * 3. Returns { repoUrl, repoName } so the frontend can set it as the migration source
 *    and proceed through the normal Step 1 → payment → deploy flow.
 *
 * ZIP support: the frontend extracts the ZIP client-side (using JSZip) and sends
 * the extracted { path, content } array here — this route never sees a raw ZIP.
 */
const express       = require('express');
const router        = express.Router();
const fetch         = require('node-fetch');
const { requireAuth } = require('../middleware/auth');

// ─── helpers ────────────────────────────────────────────────────────────────

function toBase64(str) {
  return Buffer.from(str, 'utf8').toString('base64');
}

/** Slugify an app name into a valid GitHub repo name */
function slugify(name) {
  return (name || 'my-app')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'my-app';
}

/** Redact a GitHub PAT so it never appears in logs */
function redactToken(token) {
  if (!token || token.length < 8) return '[token]';
  return token.slice(0, 4) + '…' + token.slice(-4);
}

/**
 * Create a new GitHub repo via the REST API.
 * Returns { owner, repo, html_url }.
 */
async function createGithubRepo(token, repoName, description) {
  const res = await fetch('https://api.github.com/user/repos', {
    method : 'POST',
    headers: {
      Authorization : `Bearer ${token}`,
      Accept        : 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name       : repoName,
      description: description || 'Created by MigrateBot',
      private    : true,
      auto_init  : false,   // we push files ourselves
    }),
  });

  if (res.status === 422) {
    // Repo already exists — append a timestamp and retry once
    const ts      = Date.now().toString(36);
    const newName = `${repoName}-${ts}`;
    return createGithubRepo(token, newName, description);
  }
  if (!res.ok) {
    // Scrub token from the raw GitHub error body before re-throwing
    const raw = await res.text();
    const safe = raw.replace(token, redactToken(token));
    throw new Error(`Could not create GitHub repo: ${safe}`);
  }
  const data = await res.json();
  return { owner: data.owner.login, repo: data.name, html_url: data.html_url };
}

/**
 * Push a single file to a GitHub repo.
 * Always creates (no existing SHA needed since the repo is brand new).
 */
async function pushFile(token, owner, repo, filePath, content, message) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
    {
      method : 'PUT',
      headers: {
        Authorization : `Bearer ${token}`,
        Accept        : 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        content: toBase64(content),
      }),
    }
  );
  if (!res.ok) {
    const raw = await res.text();
    const safe = raw.replace(token, redactToken(token));
    throw new Error(`Failed to push ${filePath}: ${safe}`);
  }
  return res.json();
}

// ─── route ──────────────────────────────────────────────────────────────────

router.post('/', requireAuth, async (req, res) => {
  const { files = [], appName, githubToken } = req.body;

  // Validate
  if (!githubToken) {
    return res.status(400).json({
      error: 'A GitHub Personal Access Token is required to create your repo. See the guide above the form.',
    });
  }
  if (!files.length) {
    return res.status(400).json({ error: 'No files provided.' });
  }
  for (const f of files) {
    if (!f.path || typeof f.content !== 'string') {
      return res.status(400).json({ error: `File "${f.path || '?'}" is missing content.` });
    }
  }

  // Cap at 100 files / 500 KB per file to prevent abuse
  if (files.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 files per upload. Please ZIP only your source files.' });
  }
  for (const f of files) {
    if (f.content.length > 500_000) {
      return res.status(400).json({ error: `File "${f.path}" is too large (max 500 KB per file).` });
    }
  }

  try {
    const repoName = slugify(appName || 'my-app');

    // 1. Create repo
    const { owner, repo, html_url } = await createGithubRepo(
      githubToken,
      repoName,
      `My app — migrated with MigrateBot`
    );

    // 2. Push every file sequentially (GitHub Contents API is not parallel-safe for new repos)
    const commitMessage = 'Initial upload via MigrateBot';
    for (const file of files) {
      await pushFile(githubToken, owner, repo, file.path, file.content, commitMessage);
    }

    // 3. Return the new repo URL — frontend sets this as repoUrl and advances to Step 1
    return res.json({
      success : true,
      repoUrl : html_url,
      repoName: repo,
      owner,
      filesUploaded: files.length,
      message : `Created GitHub repo "${repo}" with ${files.length} file${files.length > 1 ? 's' : ''}. Proceeding to deployment setup…`,
    });

  } catch (err) {
    // Never log the raw error — it may contain the token in a GitHub API response body
    const safeMsg = err.message ? err.message.replace(githubToken || '', redactToken(githubToken)) : 'Unknown error';
    console.error('[upload-source]', safeMsg);
    return res.status(500).json({ error: safeMsg || 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
