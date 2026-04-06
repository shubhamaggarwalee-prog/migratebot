/**
 * backend/routes/admin.js
 *
 * Admin-only API routes. Every endpoint is guarded by requireAdmin which
 * verifies the caller's email matches the ADMIN_EMAIL environment variable.
 *
 * Routes:
 *   GET  /api/admin/stats
 *   GET  /api/admin/users
 *   GET  /api/admin/migrations
 *   POST /api/admin/refund/:migrationId
 */

'use strict';

const { Router } = require('express');
const Stripe     = require('stripe');
const { supabaseAdmin } = require('../utils/supabase');
const auth       = require('../middleware/auth');
const logger     = require('../utils/logger');

const router = Router();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ── requireAdmin middleware ───────────────────────────────────────────────────
// Must run after the standard `auth` middleware so req.email is populated.
function requireAdmin(req, res, next) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    logger.error('ADMIN_EMAIL env var is not set — admin routes are disabled');
    return res.status(503).json({ error: 'Admin access is not configured' });
  }
  if (req.email !== adminEmail) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// Apply auth + admin guard to every route in this file
router.use(auth);
router.use(requireAdmin);

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
// Returns headline KPIs for the admin dashboard.
router.get('/stats', async (req, res, next) => {
  try {
    // Total registered users via Supabase auth admin API
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1 });
    if (usersError) throw usersError;
    const totalUsers = usersData?.total || 0;

    // Migration stats from DB
    const { data: migData, error: migError } = await supabaseAdmin
      .from('migrations')
      .select('status, amount_charged, amount_refunded');
    if (migError) throw migError;

    const rows           = migData || [];
    const totalMigrations = rows.length;
    const failedCount     = rows.filter(r => r.status === 'failed').length;
    const activeCount     = rows.filter(r => ['deploying', 'analyzing', 'pending'].includes(r.status)).length;
    const totalRevenue    = rows.reduce((s, r) => s + (r.amount_charged  || 0), 0);
    const totalRefunded   = rows.reduce((s, r) => s + (r.amount_refunded || 0), 0);
    const netRevenue      = totalRevenue - totalRefunded;

    res.json({
      totalUsers,
      totalMigrations,
      failedCount,
      activeCount,
      totalRevenue,
      totalRefunded,
      netRevenue,
    });
  } catch (err) {
    logger.error('GET /admin/stats error:', err.message);
    next(err);
  }
});

// ── GET /api/admin/users ──────────────────────────────────────────────────────
// Returns paginated list of all users with their migration counts.
// Query params: page (default 1), limit (default 25, max 100)
router.get('/users', async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 25);

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: limit,
    });
    if (authError) throw authError;

    const userIds = (authData?.users || []).map(u => u.id);

    // Fetch migration counts for these users in one query
    let migCounts = {};
    if (userIds.length > 0) {
      const { data: migs } = await supabaseAdmin
        .from('migrations')
        .select('user_id, status')
        .in('user_id', userIds);

      (migs || []).forEach(m => {
        if (!migCounts[m.user_id]) migCounts[m.user_id] = { total: 0, failed: 0, success: 0 };
        migCounts[m.user_id].total++;
        if (m.status === 'failed')  migCounts[m.user_id].failed++;
        if (m.status === 'success') migCounts[m.user_id].success++;
      });
    }

    const users = (authData?.users || []).map(u => ({
      id:         u.id,
      email:      u.email,
      name:       u.user_metadata?.name || null,
      createdAt:  u.created_at,
      lastSignIn: u.last_sign_in_at,
      migrations: migCounts[u.id] || { total: 0, failed: 0, success: 0 },
    }));

    res.json({
      users,
      pagination: {
        page,
        limit,
        total:      authData?.total || 0,
        totalPages: Math.ceil((authData?.total || 0) / limit),
      },
    });
  } catch (err) {
    logger.error('GET /admin/users error:', err.message);
    next(err);
  }
});

// ── GET /api/admin/migrations ─────────────────────────────────────────────────
// Returns paginated list of all migrations across all users.
// Query params: page, limit, status (filter)
router.get('/migrations', async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 25);
    const status = req.query.status || null;
    const from   = (page - 1) * limit;
    const to     = from + limit - 1;

    let query = supabaseAdmin
      .from('migrations')
      .select(
        'id, user_id, repourl, source_platform, tier, status, amount_charged, amount_refunded, stripe_payment_intent_id, created_at',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) query = query.eq('status', status);

    const { data, count, error } = await query;
    if (error) throw error;

    // Batch-fetch user emails for display
    const userIds = [...new Set((data || []).map(m => m.user_id))];
    let emailMap  = {};
    if (userIds.length > 0) {
      // listUsers doesn't support IN filter — fetch page by page isn't practical;
      // use the users table if it exists, otherwise skip gracefully
      const { data: uRows } = await supabaseAdmin
        .from('users')
        .select('id, email')
        .in('id', userIds);
      (uRows || []).forEach(u => { emailMap[u.id] = u.email; });
    }

    const migrations = (data || []).map(m => ({
      ...m,
      userEmail: emailMap[m.user_id] || null,
      canRefund: m.stripe_payment_intent_id &&
                 m.amount_charged > 0 &&
                 m.status !== 'refunded',
    }));

    res.json({
      migrations,
      pagination: {
        page,
        limit,
        total:      count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    logger.error('GET /admin/migrations error:', err.message);
    next(err);
  }
});

// ── POST /api/admin/refund/:migrationId ──────────────────────────────────────
// Issues a full Stripe refund for a migration and updates its DB record.
router.post('/refund/:migrationId', async (req, res, next) => {
  const { migrationId } = req.params;

  try {
    const { data: migration, error } = await supabaseAdmin
      .from('migrations')
      .select('id, status, amount_charged, amount_refunded, stripe_payment_intent_id')
      .eq('id', migrationId)
      .single();

    if (error || !migration) {
      return res.status(404).json({ error: 'Migration not found' });
    }
    if (migration.status === 'refunded') {
      return res.status(400).json({ error: 'Migration is already refunded' });
    }
    if (!migration.stripe_payment_intent_id) {
      return res.status(400).json({ error: 'No Stripe payment intent on this migration' });
    }
    if (!migration.amount_charged || migration.amount_charged <= 0) {
      return res.status(400).json({ error: 'No charge to refund' });
    }

    // Calculate remaining refundable amount (in case of partial prior refund)
    const alreadyRefunded = migration.amount_refunded || 0;
    const refundable      = migration.amount_charged - alreadyRefunded;
    if (refundable <= 0) {
      return res.status(400).json({ error: 'Full amount already refunded' });
    }

    // Issue Stripe refund against the payment intent
    const refund = await stripe.refunds.create({
      payment_intent: migration.stripe_payment_intent_id,
      amount:         refundable, // amount is in cents
      reason:         'requested_by_customer',
    });

    // Update migration record
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('migrations')
      .update({
        status:           'refunded',
        amount_refunded:  alreadyRefunded + refundable,
        stripe_refund_id: refund.id,
      })
      .eq('id', migrationId)
      .select()
      .single();

    if (updateError) throw updateError;

    logger.info(`Admin refund issued: migration=${migrationId} refund=${refund.id} amount=${refundable}`);
    res.json({ migration: updated, refund: { id: refund.id, amount: refundable } });
  } catch (err) {
    logger.error(`POST /admin/refund/${migrationId} error:`, err.message);
    next(err);
  }
});

module.exports = router;
