/**
 * backend/routes/credentials.js
 * Encrypted credential storage + live validation for migrations.
 *
 * Platforms supported: github | supabase | vercel | railway | replit
 */
const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/encryption');
const { supabaseAdmin }    = require('../utils/supabase');
const logger               = require('../utils/logger');

// Lazy-load platform service classes so missing optional deps don't crash boot
function getValidator(platform) {
  switch (platform) {
    case 'replit':  return require('../services/replit');
    case 'github':  return null; // validated inline below
    default:        return null;
  }
}

// POST /api/credentials
router.post('/', auth, async (req, res) => {
  try {
    const { migration_id, platform, credentials } = req.body;
    if (!migration_id || !platform || !credentials) {
      return res.status(400).json({ error: 'migration_id, platform, and credentials required' });
    }
    const encrypted = encrypt(JSON.stringify(credentials));
    const { data, error } = await supabaseAdmin
      .from('credentials')
      .upsert([{ migration_id, user_id: req.userId, platform, encrypted_data: encrypted }])
      .select().single();
    if (error) throw error;
    res.status(201).json({ id: data.id, platform, message: 'Credentials stored securely' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/credentials/:migration_id
router.get('/:migration_id', auth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('credentials')
      .select('id, platform, created_at')
      .eq('migration_id', req.params.migration_id)
      .eq('user_id', req.userId);
    if (error) throw error;
    res.json({ credentials: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/credentials/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('credentials')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);
    if (error) throw error;
    res.json({ message: 'Credentials deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/credentials/validate
 * Live-validates a token for a given platform without storing it.
 *
 * Body: { platform: string, token: string }
 * Response 200: { valid: true, meta: { ... platform-specific info ... } }
 * Response 400: { valid: false, error: string }
 */
router.post('/validate', auth, async (req, res) => {
  const { platform, token } = req.body;

  if (!platform || !token) {
    return res.status(400).json({ valid: false, error: 'platform and token are required' });
  }

  const SUPPORTED = ['github', 'replit', 'supabase', 'vercel', 'railway'];
  if (!SUPPORTED.includes(platform)) {
    return res.status(400).json({ valid: false, error: `Unsupported platform: ${platform}` });
  }

  try {
    let meta = {};

    if (platform === 'replit') {
      // Instantiate ReplitService and call getUser() — throws on bad token
      const ReplitService = require('../services/replit');
      const replit = new ReplitService(token);
      const user   = await replit.getUser();
      meta = { username: user.username, displayName: user.displayName, email: user.email };

    } else if (platform === 'github') {
      // Hit GitHub's /user endpoint directly — lightweight, no SDK needed
      const { Octokit } = require('@octokit/rest');
      const octokit = new Octokit({ auth: token });
      const { data } = await octokit.rest.users.getAuthenticated();
      meta = { username: data.login, name: data.name, email: data.email };

    } else if (platform === 'supabase') {
      // Validate by listing Supabase orgs (requires valid service/management token)
      const SupabaseService = require('../services/supabase');
      const sb   = new SupabaseService(token);
      const orgs = await sb.getOrganizations();
      meta = { organizations: orgs.length };

    } else if (platform === 'vercel') {
      const VercelService = require('../services/vercel');
      const vercel = new VercelService(token);
      const user   = await vercel.getUser();
      meta = { username: user.username, email: user.email };

    } else if (platform === 'railway') {
      const RailwayService = require('../services/railway');
      const railway = new RailwayService(token);
      const user    = await railway.getUser();
      meta = { name: user.name, email: user.email };
    }

    logger.info(`Credential validated — platform=${platform} user=${meta.username || meta.email || 'ok'}`);
    return res.json({ valid: true, meta });

  } catch (err) {
    logger.warn(`Credential validation failed — platform=${platform}: ${err.message}`);
    return res.status(400).json({ valid: false, error: err.message });
  }
});

module.exports = router;
