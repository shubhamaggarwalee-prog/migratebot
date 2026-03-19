/**
 * backend/routes/passwordReset.js
 *
 *   POST /api/auth/forgot-password   Generate reset token + send email
 *   POST /api/auth/reset-password    Validate token + set new password
 */

'use strict';

const { Router } = require('express');
const crypto     = require('crypto');
const bcrypt     = require('bcryptjs');
const supabase   = require('../utils/database');
const { sendPasswordReset } = require('../services/email');
const logger     = require('../utils/logger');

const router = Router();

const TOKEN_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes
const BCRYPT_ROUNDS   = 12;

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
// Body: { email }
// Always returns 200 to prevent email enumeration.
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const { data: user } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('email', email.toLowerCase().trim())
      .single();

    // Always respond OK — don't reveal whether the email exists
    if (!user) {
      return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
    }

    const rawToken  = crypto.randomBytes(32).toString('hex');
    const payload   = `${user.id}.${rawToken}.${Date.now()}`;
    const token     = Buffer.from(payload).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await supabase
      .from('users')
      .update({
        password_reset_token:      tokenHash,
        password_reset_expires_at: new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString(),
      })
      .eq('id', user.id);

    await sendPasswordReset(user.email, user.name, token);
    logger.info(`Password reset email sent to ${user.email}`);

    res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    logger.error('POST /forgot-password error:', err.message);
    next(err);
  }
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
// Body: { token, password }
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'token and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Decode token
    let userId, rawToken, issuedAt;
    try {
      const parts = Buffer.from(token, 'base64url').toString('utf8').split('.');
      if (parts.length !== 3) throw new Error('bad format');
      [userId, rawToken, issuedAt] = parts;
    } catch {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    if (Date.now() - Number(issuedAt) > TOKEN_EXPIRY_MS) {
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const { data: user, error } = await supabase
      .from('users')
      .select('id, password_reset_token, password_reset_expires_at')
      .eq('id', userId)
      .single();

    if (error || !user) return res.status(400).json({ error: 'Invalid reset token' });

    // Constant-time token comparison
    const storedHash = user.password_reset_token || '';
    let match = false;
    try {
      match = crypto.timingSafeEqual(
        Buffer.from(tokenHash, 'hex'),
        Buffer.from(storedHash, 'hex')
      );
    } catch { match = false; }

    if (!match) return res.status(400).json({ error: 'Invalid reset token' });

    // Double-check DB-side expiry
    if (user.password_reset_expires_at && new Date(user.password_reset_expires_at) < new Date()) {
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await supabase
      .from('users')
      .update({
        password_hash:             passwordHash,
        password_reset_token:      null,
        password_reset_expires_at: null,
      })
      .eq('id', userId);

    logger.info(`Password reset successfully for user ${userId}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('POST /reset-password error:', err.message);
    next(err);
  }
});

module.exports = router;
