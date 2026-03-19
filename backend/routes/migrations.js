/**
 * backend/routes/migrations.js
 * Migration CRUD and job management
 */
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { supabaseAdmin } = require('../utils/supabase');
const { addMigrationJob } = require('../utils/queue');
const AnalyzerAgent = require('../../agent/analyzer');

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
    const { repourl, branch = 'main', source_platform = 'github', tier = 'standard' } = req.body;
    if (!repourl) return res.status(400).json({ error: 'repourl is required' });

    const { data, error } = await supabaseAdmin
      .from('migrations')
      .insert([{ user_id: req.userId, repourl, branch, source_platform, tier, status: 'pending' }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ migration: data });
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
    if (migration.status !== 'paid') return res.status(400).json({ error: 'Migration must be paid before starting' });

    await supabaseAdmin.from('migrations').update({ status: 'deploying' }).eq('id', migration.id);
    await addMigrationJob(migration);

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
