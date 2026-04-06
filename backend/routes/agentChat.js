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
 *
 * Task 5: Added 30-second AbortController timeout around agent.chat() so a
 *         hanging Anthropic request cannot hold the HTTP connection open forever.
 *
 * Task 8: Replaced .single() on the credentials query with .limit(1) so that
 *         a user who has multiple Anthropic credentials across different
 *         migrations doesn't get a PGRST116 "multiple rows" error. We take
 *         the first row returned instead.
 *
 * Task 13: Added stack: err.stack to logger.error for production debuggability.
 */
const express        = require('express');
const router         = express.Router();
const auth           = require('../middleware/auth');
const MigrationAgent = require('../services/migrationAgent');
const { decrypt }    = require('../utils/encryption');
const { supabaseAdmin } = require('../utils/database');
const logger         = require('../utils/logger');

const AGENT_CHAT_TIMEOUT_MS = 30_000; // 30 seconds

// POST /api/agent/chat
router.post('/chat', auth, async (req, res) => {
  const { migration_id, messages, context = {} } = req.body;

  if (!migration_id || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'migration_id and messages are required.' });
  }

  try {
    // ── 1. Fetch the user's encrypted Anthropic key ────────────────────────────
    // Task 8: Use .limit(1) instead of .single() so that a user who has stored
    // Anthropic credentials against more than one migration doesn't cause a
    // PGRST116 "multiple rows returned" error. The most-specific match
    // (migration_id + user_id + platform) already makes the result
    // deterministic; we just take element [0] instead of letting PostgREST
    // enforce a strict one-row contract.
    const { data: credRows, error: credErr } = await supabaseAdmin
      .from('credentials')
      .select('encrypted_data')
      .eq('migration_id', migration_id)
      .eq('user_id', req.userId)
      .eq('platform', 'anthropic')
      .limit(1);

    const credRow = credRows?.[0] ?? null;

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

    // ── 4. Call agent.chat() with a hard 30-second timeout ─────────────────────
    // Without this, a stalled Anthropic request holds the HTTP connection open
    // indefinitely, exhausting the Node.js connection pool under load.
    const agent      = new MigrationAgent(anthropicKey, null, migration_id);
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), AGENT_CHAT_TIMEOUT_MS);

    let result;
    try {
      result = await agent.chat(messages, migrationContext, { signal: controller.signal });
    } catch (chatErr) {
      if (chatErr.name === 'AbortError' || controller.signal.aborted) {
        return res.status(504).json({ error: 'The AI assistant took too long to respond. Please try again.' });
      }
      throw chatErr;
    } finally {
      clearTimeout(timer);
    }

    logger.info(`AgentChat — migration=${migration_id} user=${req.userId} resolved=${result.resolved} skip=${result.skipStep}`);

    res.json(result);

  } catch (err) {
    if (err?.status === 401) {
      return res.status(400).json({ error: 'Your Anthropic API key is invalid or expired. Please update it in the wizard.' });
    }
    // Task 13: Include stack trace so production log aggregators (Papertrail,
    // Datadog, etc.) can pinpoint the exact source line without needing to
    // reproduce the error locally.
    logger.error('AgentChat error:', { message: err.message, stack: err.stack });
    res.status(500).json({ error: err.message || 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
