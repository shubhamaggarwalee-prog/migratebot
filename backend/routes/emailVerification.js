/**
 * backend/routes/emailVerification.js
 *
 *   POST /api/email/verify
 *   POST /api/email/resend
 */

'use strict';

const { Router } = require('express');
const crypto     = require('crypto');
const supabase   = require('../utils/database');
const auth       = require('../middleware/auth');
const { sendWelcome } = require('../services/email');
const logger     = require('../utils/logger');

const router = Router();

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

router.post('/verify', async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token is required' });

    const parts = Buffer.from(token, 'base64url').toString('utf8').split('.');
    if (parts.length !== 3) return res.status(400).json({ error: 'Invalid token format' });
    const [userId, rawToken, issuedAt] = parts;

    if (Date.now() - Number(issuedAt) > TOKEN_EXPIRY_MS) {
      return res.status(400).json({ error: 'Verification link has expired. Request a new one.' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email_verified, email_verify_token')
      .eq('id', userId)
      .single();

    if (error || !user) return res.status(400).json({ error: 'Invalid token' });
    if (user.email_verified) return res.json({ success: true, alreadyVerified: true });

    const expected = Buffer.from(user.email_verify_token || '', 'utf8');
    const provided = Buffer.from(rawToken, 'utf8');
    const match = expected.length === provided.length &&
      crypto.timingSafeEqual(expected, provided);

    if (!match) return res.status(400).json({ error: 'Invalid token' });

    await supabase
      .from('users')
      .update({ email_verified: true, email_verify_token: null })
      .eq('id', userId);

    logger.info(`Email verified for user ${userId}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('POST /email/verify error:', err.message);
    next(err);
  }
});

router.post('/resend', auth, async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, email_verified')
      .eq('id', req.userId)
      .single();

    if (error || !user) return res.status(404).json({ error: 'User not found' });
    if (user.email_verified) return res.status(400).json({ error: 'Email is already verified' });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const payload  = `${user.id}.${rawToken}.${Date.now()}`;
    const token    = Buffer.from(payload).toString('base64url');

    await supabase.from('users').update({ email_verify_token: rawToken }).eq('id', user.id);

    await sendWelcome(user.email, user.name, token);
    logger.info(`Verification email resent to ${user.email}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('POST /email/resend error:', err.message);
    next(err);
  }
});

module.exports = router;
