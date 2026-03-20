/**
 * backend/routes/notifications.js
 *
 *   POST   /api/notifications/slack
 *   POST   /api/notifications/slack/test
 *   DELETE /api/notifications/slack
 *   PUT    /api/notifications/prefs
 *   GET    /api/notifications/prefs
 */

'use strict';

const { Router } = require('express');
const axios      = require('axios');
const supabase   = require('../utils/database');
const auth       = require('../middleware/auth');
const logger     = require('../utils/logger');

const router = Router();
router.use(auth);

const DEFAULT_PREFS = {
  migration_completed: true,
  migration_failed:    true,
  health_check_alerts: true,
  product_updates:     false,
  billing_receipts:    true,
};

router.post('/slack', async (req, res, next) => {
  try {
    const { webhookUrl } = req.body;
    if (!webhookUrl) return res.status(400).json({ error: 'webhookUrl is required' });
    if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
      return res.status(400).json({ error: 'Invalid Slack webhook URL' });
    }
    await supabase.from('users').update({ slack_webhook: webhookUrl }).eq('id', req.userId);
    logger.info(`Slack webhook saved for user ${req.userId}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('POST /notifications/slack error:', err.message);
    next(err);
  }
});

router.post('/slack/test', async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('slack_webhook, name')
      .eq('id', req.userId)
      .single();
    if (error || !user) return res.status(404).json({ error: 'User not found' });
    if (!user.slack_webhook) return res.status(400).json({ error: 'No Slack webhook configured' });

    await axios.post(user.slack_webhook, {
      text: `🚀 *MigrateBot* — test notification for *${user.name || 'your account'}*. Slack notifications are working correctly!`,
    }, { timeout: 5000 });

    res.json({ success: true });
  } catch (err) {
    if (err.response) {
      return res.status(400).json({ error: `Slack returned an error: ${err.response.status} ${err.response.data}` });
    }
    logger.error('POST /notifications/slack/test error:', err.message);
    next(err);
  }
});

router.delete('/slack', async (req, res, next) => {
  try {
    await supabase.from('users').update({ slack_webhook: null }).eq('id', req.userId);
    logger.info(`Slack webhook removed for user ${req.userId}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('DELETE /notifications/slack error:', err.message);
    next(err);
  }
});

router.put('/prefs', async (req, res, next) => {
  try {
    const allowed = Object.keys(DEFAULT_PREFS);
    const updates = {};
    for (const key of allowed) {
      if (typeof req.body[key] === 'boolean') updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid preference keys provided', allowed });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('notification_prefs')
      .eq('id', req.userId)
      .single();
    if (error || !user) return res.status(404).json({ error: 'User not found' });

    const merged = { ...DEFAULT_PREFS, ...(user.notification_prefs || {}), ...updates };
    await supabase.from('users').update({ notification_prefs: merged }).eq('id', req.userId);

    res.json({ success: true, prefs: merged });
  } catch (err) {
    logger.error('PUT /notifications/prefs error:', err.message);
    next(err);
  }
});

router.get('/prefs', async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('notification_prefs, slack_webhook')
      .eq('id', req.userId)
      .single();
    if (error || !user) return res.status(404).json({ error: 'User not found' });

    res.json({
      prefs:          { ...DEFAULT_PREFS, ...(user.notification_prefs || {}) },
      slackConnected: !!user.slack_webhook,
    });
  } catch (err) {
    logger.error('GET /notifications/prefs error:', err.message);
    next(err);
  }
});

module.exports = router;
