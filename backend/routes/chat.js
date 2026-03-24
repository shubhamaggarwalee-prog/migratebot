/**
 * backend/routes/chat.js
 * POST /api/chat
 *
 * Lets a user chat with Claude about their deployed app.
 * Uses the Anthropic API key they saved during the migration wizard.
 *
 * Body:    { migration_id: string, messages: [{ role, content }] }
 * Returns: { reply: string }
 */
const express  = require('express');
const router   = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const auth     = require('../middleware/auth');
const { decrypt }       = require('../utils/encryption');
const { supabaseAdmin } = require('../utils/supabase');
const logger            = require('../utils/logger');

// POST /api/chat
router.post('/', auth, async (req, res) => {
  const { migration_id, messages } = req.body;

  if (!migration_id || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'migration_id and messages are required' });
  }

  try {
    // ── 1. Fetch the user's encrypted Anthropic key for this migration ────────
    const { data: credRow, error: credErr } = await supabaseAdmin
      .from('credentials')
      .select('encrypted_data')
      .eq('migration_id', migration_id)
      .eq('user_id', req.userId)
      .eq('platform', 'anthropic')
      .single();

    if (credErr || !credRow) {
      return res.status(404).json({
        error: 'Anthropic API key not found for this migration. Please re-run the wizard and add your key.',
      });
    }

    // ── 2. Decrypt the key ────────────────────────────────────────────────────
    let anthropicKey;
    try {
      const parsed = JSON.parse(decrypt(credRow.encrypted_data));
      // Credentials are stored as { token: 'sk-ant-...' } or { anthropicKey: '...' }
      anthropicKey = parsed.token || parsed.anthropicKey;
    } catch {
      return res.status(500).json({ error: 'Failed to decrypt Anthropic key.' });
    }

    if (!anthropicKey) {
      return res.status(400).json({ error: 'Anthropic key is empty. Please reconnect in the wizard.' });
    }

    // ── 3. Fetch migration details for context ────────────────────────────────
    const { data: migration } = await supabaseAdmin
      .from('migrations')
      .select('repourl, reponame, source_platform, platforms, deployed_urls, status')
      .eq('id', migration_id)
      .eq('user_id', req.userId)
      .single();

    const appName     = migration?.reponame || migration?.repourl || 'the app';
    const source      = migration?.source_platform || 'unknown';
    const platforms   = (migration?.platforms || []).join(', ') || 'Vercel/Railway/Supabase';
    const deployedUrls = migration?.deployed_urls
      ? Object.entries(migration.deployed_urls)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n')
      : 'URLs not available';

    const systemPrompt = [
      `You are Claude, an AI assistant embedded in MigrateBot — a service that deploys web apps for non-technical users.`,
      `You just helped deploy the user's app called "${appName}" from ${source} to ${platforms}.`,
      `The live URLs are:\n${deployedUrls}`,
      ``,
      `Your job is to help the user manage, update, and understand their deployed app.`,
      `Always use plain English — assume the user is not a developer.`,
      `Keep answers concise, friendly, and actionable. Use numbered steps when giving instructions.`,
      `If asked something outside your knowledge, say so honestly and suggest they email support@migratebot.io.`,
    ].join('\n');

    // ── 4. Call Claude ────────────────────────────────────────────────────────
    const client = new Anthropic({ apiKey: anthropicKey });

    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({
        role:    m.role    === 'assistant' ? 'assistant' : 'user',
        content: m.content || m.text || '',
      })),
    });

    const reply = response.content?.[0]?.text || 'Sorry, I could not generate a response.';

    logger.info(`Claude chat — migration=${migration_id} user=${req.userId} tokens=${response.usage?.input_tokens}+${response.usage?.output_tokens}`);

    res.json({ reply });

  } catch (err) {
    // Surface Anthropic API errors clearly
    if (err?.status === 401) {
      return res.status(400).json({ error: 'Your Anthropic API key is invalid or expired. Please update it in the wizard.' });
    }
    logger.error('Chat error:', { message: err.message });
    res.status(500).json({ error: err.message || 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
