/**
 * backend/routes/webhooks.js
 * Stripe webhook handler
 *
 * Fix 7: After payment_intent.succeeded marks a migration as 'paid',
 *        a 60-second safety timer checks whether the job has started.
 *        If still 'paid' after 60 s, auto-triggers the job from the DB
 *        record and sends the user a confirmation email.
 */
const express        = require('express');
const router         = express.Router();
const stripe         = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabaseAdmin } = require('../utils/supabase');
const { runMigration }  = require('../services/migrationRunner');
const { sendMigrationComplete } = require('../services/email');
const logger         = require('../utils/logger');

// ─── Fix 7: 60-second safety trigger ─────────────────────────────────────────
/**
 * After Stripe confirms payment, wait 60 seconds and check if the Bull job
 * has already picked up the migration (status moved away from 'paid').
 * If it hasn't, run it directly so the user is never left hanging.
 */
function scheduleJobSafetyCheck(migrationId) {
  setTimeout(async () => {
    try {
      // Re-fetch the current status
      const { data: migration, error } = await supabaseAdmin
        .from('migrations')
        .select('*')
        .eq('id', migrationId)
        .single();

      if (error || !migration) {
        logger.warn(`Fix7 safety check: migration ${migrationId} not found`);
        return;
      }

      // If the job has already started or finished, do nothing
      if (migration.status !== 'paid') {
        logger.info(`Fix7 safety check: migration ${migrationId} already in status '${migration.status}' — no action needed`);
        return;
      }

      // Job never started — trigger it now
      logger.warn(`Fix7 safety check: migration ${migrationId} still 'paid' after 60 s — auto-triggering job`);

      // Mark as running before we start so concurrent checks don't double-fire
      await supabaseAdmin
        .from('migrations')
        .update({ status: 'running', updated_at: new Date().toISOString() })
        .eq('id', migrationId)
        .eq('status', 'paid'); // only update if still 'paid' (race-condition guard)

      // Re-fetch after the conditional update to confirm we won the race
      const { data: confirmed } = await supabaseAdmin
        .from('migrations')
        .select('status')
        .eq('id', migrationId)
        .single();

      if (!confirmed || confirmed.status !== 'running') {
        logger.info(`Fix7 safety check: another process already started migration ${migrationId}`);
        return;
      }

      // Send confirmation email so the user knows payment was received
      try {
        const { data: authData } = await supabaseAdmin.auth.admin.getUserById(migration.user_id);
        const userEmail = authData?.user?.email;
        const userName  = authData?.user?.user_metadata?.name || authData?.user?.user_metadata?.full_name || '';
        if (userEmail) {
          await sendMigrationComplete(
            userEmail,
            migration.repo_url || 'your project',
            { frontend: null, backend: null, database: null },
            migrationId,
            userName,
            { type: 'payment_confirmed' } // signal to email template this is a "starting" email, not a "done" email
          );
        }
      } catch (emailErr) {
        logger.warn(`Fix7 safety check: confirmation email failed for ${migrationId}: ${emailErr.message}`);
      }

      // Run the migration directly (no Bull queue, direct execution)
      await runMigration(migration, null, null);

    } catch (err) {
      logger.error(`Fix7 safety check failed for migration ${migrationId}: ${err.message}`, err.stack);
    }
  }, 60_000); // 60 seconds
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /webhooks/stripe
router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn(`Webhook signature invalid: ${err.message}`);
    return res.status(400).json({ error: 'Webhook signature verification failed.' });
  }

  try {
    switch (event.type) {

      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        const migrationId = pi.metadata?.migration_id;
        if (migrationId) {
          await supabaseAdmin
            .from('migrations')
            .update({
              status:                   'paid',
              stripe_payment_intent_id: pi.id,
              updated_at:               new Date().toISOString(),
            })
            .eq('id', migrationId);

          // Fix 7: schedule the 60-second safety check
          scheduleJobSafetyCheck(migrationId);
          logger.info(`Payment succeeded for migration ${migrationId} — safety check scheduled`);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        const migrationId = pi.metadata?.migration_id;
        if (migrationId) {
          await supabaseAdmin
            .from('migrations')
            .update({
              status:     'payment_failed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', migrationId);
          logger.info(`Payment failed for migration ${migrationId}`);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        logger.info(`Charge refunded: ${charge.id}`);
        break;
      }

      default:
        logger.info(`Unhandled Stripe event type: ${event.type}`);
    }

    res.json({ received: true });

  } catch (err) {
    // Never expose raw errors — sanitizeErrors middleware handles this,
    // but since webhooks don't go through it we guard here explicitly.
    logger.error(`Webhook handler error: ${err.message}`, err.stack);
    res.status(500).json({ error: 'Webhook processing failed. We have been notified.' });
  }
});

module.exports = router;
