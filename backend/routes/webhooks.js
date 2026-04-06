/**
 * backend/routes/webhooks.js
 * Stripe webhook handler
 *
 * Exports makeRouter(app) so the safety-check timer can resolve the live
 * Socket.io instance via app.get('io') without a circular dependency.
 *
 * Fix 7: After payment_intent.succeeded marks a migration as 'paid',
 *        a 60-second safety timer checks whether the job has started.
 *        If still 'paid' after 60 s, auto-triggers the job and passes
 *        the real io instance so socket events reach the frontend.
 *
 * Task 7: Safety timer now calls sendPaymentConfirmed (not sendMigrationComplete)
 *         so the user receives a "payment received, deployment starting" email
 *         rather than a misleading "Your app is live!" message.
 */
const express        = require('express');
const stripe         = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabaseAdmin } = require('../utils/supabase');
const { runMigration }  = require('../services/migrationRunner');
const { sendPaymentConfirmed } = require('../services/email');
const logger         = require('../utils/logger');

// ─── Fix 7: 60-second safety trigger ─────────────────────────────────────────────
/**
 * After Stripe confirms payment, wait 60 seconds and check if the Bull job
 * has already picked up the migration (status moved away from 'paid').
 * If it hasn't, run it directly so the user is never left hanging.
 *
 * @param {string} migrationId
 * @param {import('express').Application} app  - Express app, used to resolve io
 */
function scheduleJobSafetyCheck(migrationId, app) {
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

      // Task 7: Send a "payment confirmed, deployment starting" email.
      // sendPaymentConfirmed is a dedicated honest template — it does NOT say
      // "Your app is live". The live-URL email is sent by migrationRunner when
      // deployment actually completes.
      try {
        const { data: authData } = await supabaseAdmin.auth.admin.getUserById(migration.user_id);
        const userEmail = authData?.user?.email;
        const userName  = authData?.user?.user_metadata?.name || authData?.user?.user_metadata?.full_name || '';
        if (userEmail) {
          await sendPaymentConfirmed(
            userEmail,
            migration.repo_url || 'your project',
            migrationId,
            userName,
          );
        }
      } catch (emailErr) {
        logger.warn(`Fix7 safety check: confirmation email failed for ${migrationId}: ${emailErr.message}`);
      }

      // Resolve the live Socket.io instance from the Express app.
      // app.set('io', io) is called in server.js immediately after io is created,
      // so this is always populated by the time the 60-second timer fires.
      const io = app.get('io');
      if (!io) {
        logger.warn(`Fix7 safety check: io not found on app — socket events will not be emitted for migration ${migrationId}`);
      }

      // Use a deterministic synthetic job ID so migrationRunner can tag logs
      // without receiving a null jobId (which causes crashes in some log paths).
      const syntheticJobId = `safety-${migrationId}`;

      // Run the migration directly (no Bull queue, direct execution)
      await runMigration(migration, io, syntheticJobId);

    } catch (err) {
      logger.error(`Fix7 safety check failed for migration ${migrationId}: ${err.message}`, err.stack);
    }
  }, 60_000); // 60 seconds
}

// ─── Router factory ────────────────────────────────────────────────────────────────────
/**
 * Returns an Express router with access to the app instance.
 * Called from server.js as: app.use('/api/webhooks', makeRouter(app))
 *
 * @param {import('express').Application} app
 * @returns {import('express').Router}
 */
function makeRouter(app) {
  const router = express.Router();

  // POST /api/webhooks/stripe
  router.post('/stripe', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
      // req.body is a raw Buffer here because server.js applies
      // express.raw({ type: 'application/json' }) to /api/webhooks/stripe
      // before the global express.json() middleware.
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

            // Fix 7: schedule the 60-second safety check, passing app so the
            // timer can resolve io when it fires.
            scheduleJobSafetyCheck(migrationId, app);
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
      // Never expose raw errors to Stripe — sanitizeErrors middleware handles
      // regular routes, so we guard here explicitly for the webhook path.
      logger.error(`Webhook handler error: ${err.message}`, err.stack);
      res.status(500).json({ error: 'Webhook processing failed. We have been notified.' });
    }
  });

  return router;
}

module.exports = makeRouter;
