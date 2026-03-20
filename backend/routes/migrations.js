/**
 * backend/routes/migrations.js
 * Migration CRUD and job management.
 * source_platform is stored and forwarded to the queue job so
 * migrationRunner always knows which service to use for cloning.
 */
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { supabaseAdmin } = require('../utils/supabase');
const { addMigrationJob } = require('../utils/queue');
const AnalyzerAgent = require('../../agent/analyzer');

const VALID_SOURCES = ['github', 'replit', 'emergent', 'url'];

// GET /api/migrations
router.get('/', auth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('migrations')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ migrations: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/migrations/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('migrations')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Migration not found' });
    res.json({ migration: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/migrations
router.post('/', auth, async (req, res) => {
  try {
    const {
      repourl,
      branch          = 'main',
      source_platform = 'github',
      tier            = 'standard',
      replit_token,   // optional: one-time Replit token (never persisted to DB)
    } = req.body;

    if (!repourl) {
      return res.status(400).json({ error: 'repourl is required' });
    }
    if (!VALID_SOURCES.includes(source_platform)) {
      return res.status(400).json({ error: `source_platform must be one of: ${VALID_SOURCES.join(', ')}` });
    }

    const { data, error } = await supabaseAdmin
      .from('migrations')
      .insert([{
        user_id:         req.userId,
        repourl,
        branch,
        source_platform,
        tier,
        status:          'pending',
      }])
      .select()
      .single();
    if (error) throw error;

    // Return replit_token in response so the frontend can pass it to /start;
    // we never write it to the DB — it lives only in memory for the job lifetime.
    res.status(201).json({
      migration:    data,
      // Echo back so client can include in the /start payload
      replit_token: source_platform === 'replit' ? (replit_token || null) : undefined,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/migrations/:id/analyze
router.post('/:id/analyze', auth, async (req, res) => {
  try {
    const { data: migration, error } = await supabaseAdmin
      .from('migrations')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();
    if (error || !migration) return res.status(404).json({ error: 'Migration not found' });

    await supabaseAdmin.from('migrations').update({ status: 'analyzing' }).eq('id', migration.id);

    const analysis = await AnalyzerAgent.analyze(
      migration.repourl,
      migration.source_platform || 'github',
      process.env.ANTHROPIC_API_KEY
    );

    const { data: updated } = await supabaseAdmin
      .from('migrations')
      .update({ status: 'analyzed', analysis_result: analysis })
      .eq('id', migration.id)
      .select()
      .single();

    res.json({ migration: updated, analysis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/migrations/:id/start
router.post('/:id/start', auth, async (req, res) => {
  try {
    const { data: migration, error } = await supabaseAdmin
      .from('migrations')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();
    if (error || !migration) return res.status(404).json({ error: 'Migration not found' });
    if (migration.status !== 'paid') {
      return res.status(400).json({ error: 'Migration must be paid before starting' });
    }

    await supabaseAdmin.from('migrations').update({ status: 'deploying' }).eq('id', migration.id);

    // replit_token is passed in body from the frontend (never stored in DB)
    // It gets injected into job.data so the runner can authenticate with Replit.
    const jobData = { ...migration };
    if (migration.source_platform === 'replit' && req.body.replit_token) {
      jobData.replitToken = req.body.replit_token;
    }

    await addMigrationJob(jobData);

    res.json({ message: 'Migration job queued', migrationId: migration.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/migrations/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('migrations')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);
    if (error) throw error;
    res.json({ message: 'Migration deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
