/**
 * backend/routes/credentials.js
 * Encrypted credential storage for migrations
 */
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/encryption');
const { supabaseAdmin } = require('../utils/supabase');

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

module.exports = router;
