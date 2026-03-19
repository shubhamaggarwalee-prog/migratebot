/**
 * backend/routes/health.js
 * Health check endpoints
 */
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../utils/supabase');
const { getQueue } = require('../utils/queue');

// GET /health
router.get('/', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '2.0.0' });
});

// GET /health/redis
router.get('/redis', async (_req, res) => {
  try {
    const queue = getQueue();
    await queue.client.ping();
    res.json({ redis: 'connected' });
  } catch (err) {
    res.status(503).json({ redis: 'disconnected', error: err.message });
  }
});

// GET /health/db
router.get('/db', async (_req, res) => {
  try {
    const { error } = await supabaseAdmin.from('migrations').select('count').limit(1);
    if (error) throw error;
    res.json({ database: 'connected' });
  } catch (err) {
    res.status(503).json({ database: 'disconnected', error: err.message });
  }
});

module.exports = router;
