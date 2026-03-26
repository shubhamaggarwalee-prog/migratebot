/**
 * backend/routes/agentChat.js
 * POST /api/agent/chat
 *
 * Task 19: Mid-migration agent chat — handles conversational turns while
 * a migration is paused waiting for user input.
 *
 * Intentionally separate from /api/chat (post-migration support).
 *
 * Body:    { migration_id: string, messages: [{ role, content }], context?: object }
 * Returns: { reply: string, resolved: boolean, skipStep: boolean }
 */
const express        = require('express');
const router         = express.Router();
const auth           = require('../middleware/auth');
const MigrationAgent = require('../services/migrationAgent');
const { decrypt }    = require('../utils/encryption');
const { supabaseAdmin } = require('../utils/database');
const logger         = require('../utils/logger');

// POST /api/agent/chat
router.post('/chat', auth, async (req, res) => {
  const { migration_id, messages, context = {} } = req.body;

  if (!migration_id || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'migration_id and messages are required.' });
  }

  try {
    // ── 1. Fetch the user's encrypted Anthropic key ────────────────────────────
    const { data: credRow, error: credErr } = await supabaseAdmin
      .from('credentials')
      .select('encrypted_data')
      .eq('migration_id', migration_id)
      .eq('user_id', req.userId)
      .eq('platform', 'anthropic')
      .single();

    if (credErr || !credRow) {
      return res.status(404).json({
        error: 'Anthropic API key not found for this migration. Please re-run the wizard.',
      });
    }

    // ── 2. Decrypt ─────────────────────────────────────────────────────────────
    let anthropicKey;
    try {
      const parsed = JSON.parse(decrypt(credRow.encrypted_data));
      anthropicKey = parsed.token || parsed.anthropicKey;
    } catch {
      return res.status(500).json({ error: 'Failed to decrypt Anthropic key.' });
    }

    if (!anthropicKey) {
      return res.status(400).json({ error: 'Anthropic key is empty. Please reconnect in the wizard.' });
    }

    // ── 3. Fetch migration context ────────────────────────────────────────────────
    const { data: migration } = await supabaseAdmin
      .from('migrations')
      .select('repourl, analysis, source_platform')
      .eq('id', migration_id)
      .eq('user_id', req.userId)
      .single();

    const migrationContext = {
      repourl:   migration?.repourl   || 'unknown',
      framework: migration?.analysis?.framework || 'unknown',
      language:  migration?.analysis?.language  || 'unknown',
      stepName:  context.stepName  || null,
      explanation: context.explanation || null,
    };

    // ── 4. Call agent.chat() ────────────────────────────────────────────────────
    // Pass null for io — the agent doesn't need to broadcast in the chat route
    const agent  = new MigrationAgent(anthropicKey, null, migration_id);
    const result = await agent.chat(messages, migrationContext);

    logger.info(`AgentChat — migration=${migration_id} user=${req.userId} resolved=${result.resolved} skip=${result.skipStep}`);

    res.json(result);

  } catch (err) {
    if (err?.status === 401) {
      return res.status(400).json({ error: 'Your Anthropic API key is invalid or expired. Please update it in the wizard.' });
    }
    logger.error('AgentChat error:', { message: err.message });
    res.status(500).json({ error: err.message || 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
