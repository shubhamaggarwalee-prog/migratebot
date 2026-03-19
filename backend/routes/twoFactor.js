/**
 * backend/routes/twoFactor.js
 *
 * TOTP 2FA endpoints:
 *   POST  /api/2fa/setup          Generate secret + otpauth URI (returns base32 + QR URI)
 *   POST  /api/2fa/confirm         Verify first token to activate 2FA; returns backup codes
 *   POST  /api/2fa/verify          Verify a token (used during login step-up)
 *   POST  /api/2fa/disable         Disable 2FA (requires current TOTP or backup code)
 *   POST  /api/2fa/backup-codes    Regenerate backup codes (requires current TOTP)
 */

'use strict';

const { Router }   = require('express');
const supabase     = require('../utils/database');
const { authMiddleware } = require('../middleware/auth');
const {
  generateTotpSecret,
  generateTotpUri,
  verifyTotp,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
} = require('../services/totp');
const { encrypt, decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

const router = Router();
router.use(authMiddleware);

// ─── POST /api/2fa/setup ──────────────────────────────────────────────────────
// Generates a new TOTP secret for the user but does NOT activate it yet.
// Frontend should render the returned uri as a QR code.
router.post('/setup', async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('email, totp_enabled')
      .eq('id', req.user.id)
      .single();
    if (error || !user) return res.status(404).json({ error: 'User not found' });
    if (user.totp_enabled) return res.status(400).json({ error: '2FA is already enabled' });

    const { secretBase32 } = generateTotpSecret();
    const uri = generateTotpUri(secretBase32, { issuer: 'MigrateBot', account: user.email });

    // Store encrypted pending secret (not yet activated)
    const { iv, encrypted } = encrypt(secretBase32);
    await supabase
      .from('users')
      .update({ totp_secret: `${iv}:${encrypted}` })
      .eq('id', req.user.id);

    res.json({ secretBase32, uri });
  } catch (err) {
    logger.error('POST /2fa/setup error:', err.message);
    next(err);
  }
});

// ─── POST /api/2fa/confirm ────────────────────────────────────────────────────
// Verifies the first token after scanning the QR code; activates 2FA.
router.post('/confirm', async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token is required' });

    const { data: user, error } = await supabase
      .from('users')
      .select('totp_secret, totp_enabled')
      .eq('id', req.user.id)
      .single();
    if (error || !user) return res.status(404).json({ error: 'User not found' });
    if (user.totp_enabled)  return res.status(400).json({ error: '2FA is already active' });
    if (!user.totp_secret)  return res.status(400).json({ error: 'Run /setup first' });

    const [iv, encrypted] = user.totp_secret.split(':');
    const secretBase32 = decrypt(encrypted, iv);
    const { valid } = verifyTotp(token, secretBase32);
    if (!valid) return res.status(400).json({ error: 'Invalid token. Check your authenticator app clock.' });

    // Activate + generate backup codes
    const plainCodes = generateBackupCodes(10);
    const hashedCodes = plainCodes.map(c => ({ hash: hashBackupCode(c), used: false }));

    await supabase
      .from('users')
      .update({
        totp_enabled:      true,
        totp_backup_codes: hashedCodes,
      })
      .eq('id', req.user.id);

    logger.info(`2FA activated for user ${req.user.id}`);
    res.json({ success: true, backupCodes: plainCodes });
  } catch (err) {
    logger.error('POST /2fa/confirm error:', err.message);
    next(err);
  }
});

// ─── POST /api/2fa/verify ─────────────────────────────────────────────────────
// Verify a token or backup code during login step-up.
// Returns { valid: true } on success; 401 on failure.
router.post('/verify', async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token is required' });

    const { data: user, error } = await supabase
      .from('users')
      .select('totp_secret, totp_enabled, totp_backup_codes')
      .eq('id', req.user.id)
      .single();
    if (error || !user) return res.status(404).json({ error: 'User not found' });
    if (!user.totp_enabled) return res.status(400).json({ error: '2FA is not enabled' });

    const [iv, encrypted] = user.totp_secret.split(':');
    const secretBase32 = decrypt(encrypted, iv);
    const { valid } = verifyTotp(token, secretBase32);
    if (valid) return res.json({ valid: true, method: 'totp' });

    // Try backup codes
    const codes = Array.isArray(user.totp_backup_codes) ? user.totp_backup_codes : [];
    const idx   = codes.findIndex(c => !c.used && verifyBackupCode(token, c.hash));
    if (idx === -1) return res.status(401).json({ error: 'Invalid authentication code' });

    // Mark backup code as used
    codes[idx].used = true;
    await supabase.from('users').update({ totp_backup_codes: codes }).eq('id', req.user.id);
    logger.info(`Backup code used for user ${req.user.id}`);

    res.json({ valid: true, method: 'backup_code', remaining: codes.filter(c => !c.used).length });
  } catch (err) {
    logger.error('POST /2fa/verify error:', err.message);
    next(err);
  }
});

// ─── POST /api/2fa/disable ────────────────────────────────────────────────────
router.post('/disable', async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token is required' });

    const { data: user, error } = await supabase
      .from('users')
      .select('totp_secret, totp_enabled, totp_backup_codes')
      .eq('id', req.user.id)
      .single();
    if (error || !user) return res.status(404).json({ error: 'User not found' });
    if (!user.totp_enabled) return res.status(400).json({ error: '2FA is not enabled' });

    const [iv, encrypted] = user.totp_secret.split(':');
    const secretBase32 = decrypt(encrypted, iv);
    const { valid } = verifyTotp(token, secretBase32);

    if (!valid) {
      // Allow a valid unused backup code to disable
      const codes = Array.isArray(user.totp_backup_codes) ? user.totp_backup_codes : [];
      const idx   = codes.findIndex(c => !c.used && verifyBackupCode(token, c.hash));
      if (idx === -1) return res.status(401).json({ error: 'Invalid token' });
    }

    await supabase
      .from('users')
      .update({ totp_enabled: false, totp_secret: null, totp_backup_codes: [] })
      .eq('id', req.user.id);

    logger.info(`2FA disabled for user ${req.user.id}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('POST /2fa/disable error:', err.message);
    next(err);
  }
});

// ─── POST /api/2fa/backup-codes ───────────────────────────────────────────────
// Regenerate all backup codes (invalidates all existing ones).
router.post('/backup-codes', async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token is required' });

    const { data: user, error } = await supabase
      .from('users')
      .select('totp_secret, totp_enabled')
      .eq('id', req.user.id)
      .single();
    if (error || !user) return res.status(404).json({ error: 'User not found' });
    if (!user.totp_enabled) return res.status(400).json({ error: '2FA is not enabled' });

    const [iv, encrypted] = user.totp_secret.split(':');
    const secretBase32 = decrypt(encrypted, iv);
    const { valid } = verifyTotp(token, secretBase32);
    if (!valid) return res.status(401).json({ error: 'Invalid token' });

    const plainCodes  = generateBackupCodes(10);
    const hashedCodes = plainCodes.map(c => ({ hash: hashBackupCode(c), used: false }));

    await supabase
      .from('users')
      .update({ totp_backup_codes: hashedCodes })
      .eq('id', req.user.id);

    logger.info(`Backup codes regenerated for user ${req.user.id}`);
    res.json({ backupCodes: plainCodes });
  } catch (err) {
    logger.error('POST /2fa/backup-codes error:', err.message);
    next(err);
  }
});

module.exports = router;
