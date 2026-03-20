/**
 * backend/routes/billing.js
 *
 * Stripe billing endpoints:
 *   GET  /api/billing/invoices
 *   GET  /api/billing/summary
 *   GET  /api/billing/portal
 */

'use strict';

const { Router } = require('express');
const Stripe     = require('stripe');
const supabase   = require('../utils/database');
const auth       = require('../middleware/auth');
const logger     = require('../utils/logger');

const router = Router();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// All billing routes require authentication
router.use(auth);

// GET /api/billing/invoices
router.get('/invoices', async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const from  = (page - 1) * limit;
    const to    = from + limit - 1;

    const { data, count, error } = await supabase
      .from('migrations')
      .select('id, repo_url, plan, status, amount_charged, amount_refunded, currency, stripe_payment_intent_id, created_at', { count: 'exact' })
      .eq('user_id', req.userId)
      .in('status', ['success', 'failed', 'refunded'])
      .gt('amount_charged', 0)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const invoices = (data || []).map(m => ({
      id:              m.id,
      repoUrl:         m.repo_url,
      plan:            m.plan,
      status:          m.status,
      amountCharged:   m.amount_charged,
      amountRefunded:  m.amount_refunded,
      netCharged:      m.amount_charged - (m.amount_refunded || 0),
      currency:        m.currency || 'usd',
      paymentIntentId: m.stripe_payment_intent_id,
      date:            m.created_at,
    }));

    res.json({
      invoices,
      pagination: {
        page,
        limit,
        total:      count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    logger.error('GET /billing/invoices error:', err.message);
    next(err);
  }
});

// GET /api/billing/summary
router.get('/summary', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('migrations')
      .select('plan, amount_charged, amount_refunded, status')
      .eq('user_id', req.userId)
      .gt('amount_charged', 0);

    if (error) throw error;

    const rows = data || [];
    const totalCharged  = rows.reduce((s, r) => s + (r.amount_charged  || 0), 0);
    const totalRefunded = rows.reduce((s, r) => s + (r.amount_refunded || 0), 0);

    const byPlan = rows.reduce((acc, r) => {
      if (!acc[r.plan]) acc[r.plan] = { count: 0, charged: 0, refunded: 0 };
      acc[r.plan].count++;
      acc[r.plan].charged  += r.amount_charged  || 0;
      acc[r.plan].refunded += r.amount_refunded || 0;
      return acc;
    }, {});

    res.json({
      totalCharged,
      totalRefunded,
      netCharged: totalCharged - totalRefunded,
      currency:   'usd',
      migrations: rows.length,
      byPlan,
    });
  } catch (err) {
    logger.error('GET /billing/summary error:', err.message);
    next(err);
  }
});

// GET /api/billing/portal
router.get('/portal', async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', req.userId)
      .single();

    if (error || !user) return res.status(404).json({ error: 'User not found' });
    if (!user.stripe_customer_id) {
      return res.status(400).json({ error: 'No billing account found. Complete a migration first.' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer:   user.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/settings/billing`,
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error('GET /billing/portal error:', err.message);
    next(err);
  }
});

module.exports = router;
