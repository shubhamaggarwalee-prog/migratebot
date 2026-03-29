/**
 * backend/routes/auth.js
 * Authentication routes using Supabase
 */
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../utils/supabase');
const { signToken } = require('../utils/jwt');

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { name: name || email.split('@')[0] },
    });
    if (error) return res.status(400).json({ error: error.message });

    const token = signToken({ userId: data.user.id, email });
    res.status(201).json({ token, user: { id: data.user.id, email, name: data.user.user_metadata.name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    // First, check if user exists
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = !listError && listData?.users?.some(
      u => u.email?.toLowerCase() === email.toLowerCase().trim()
    );

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });

    if (error) {
      if (!userExists) {
        return res.status(401).json({ error: 'No account found with that email. Please sign up first.' });
      }
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    const token = signToken({ userId: data.user.id, email });
    res.json({ token, user: { id: data.user.id, email, name: data.user.user_metadata?.name } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// POST /auth/logout
router.post('/logout', async (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// GET /auth/me
router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(req.userId);
    if (error) return res.status(404).json({ error: 'User not found' });
    res.json({ user: { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
