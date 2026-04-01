/**
 * backend/services/stripeJobSafety.js
 *
 * Fix 7: 60-second safety watchdog.
 *
 * After Stripe confirms payment, call scheduleJobSafetyCheck(migrationId).
 * It waits 60 seconds then checks whether the migration job has started.
 * If the status is still 'paid' (i.e. the Bull queue never picked it up),
 * it auto-triggers the job from the DB record and sends the user a
 * confirmation email so they know their payment was received and work
 * is starting.
 */

'use strict';

const { supabaseAdmin }       = require('../utils/database');
const { sendMigrationStarting } = require('./email');
const logger                  = require('../utils/logger');

const WATCHDOG_DELAY_MS = 60_000; // 60 seconds

/**
 * Schedules a single safety check for migrationId.
 * Non-blocking — fires after WATCHDOG_DELAY_MS and resolves silently.
 *
 * @param {string} migrationId
 * @param {object} [queue]  — Bull queue instance (optional).
 *                            If provided, the watchdog will add the job
 *                            directly. If omitted it falls back to updating
 *                            the DB status so a polling worker can pick it up.
 */
function scheduleJobSafetyCheck(migrationId, queue = null) {
  setTimeout(async () => {
    try {
      // Re-fetch the migration — status may have moved on already
      const { data: migration, error } = await supabaseAdmin
        .from('migrations')
        .select('id, status, user_id, repourl, platforms, source_platform, repobranch, created_at')
        .eq('id', migrationId)
        .maybeSingle();

      if (error) {
        logger.error(`[watchdog] DB read failed for ${migrationId}: ${error.message}`);
        return;
      }

      if (!migration) {
        logger.warn(`[watchdog] Migration ${migrationId} not found — skipping`);
        return;
      }

      // If already running or beyond, nothing to do
      if (migration.status !== 'paid') {
        logger.info(`[watchdog] Migration ${migrationId} status is '${migration.status}' — no action needed`);
        return;
      }

      logger.warn(`[watchdog] Migration ${migrationId} still 'paid' after 60s — auto-triggering job`);

      if (queue) {
        // Enqueue via Bull
        await queue.add(
          { migrationId: migration.id },
          { jobId: `retry-${migration.id}`, removeOnComplete: true, removeOnFail: false }
        );
        logger.info(`[watchdog] Job re-queued via Bull for ${migrationId}`);
      } else {
        // Fallback: set status to 'queued' so a polling worker picks it up
        await supabaseAdmin
          .from('migrations')
          .update({ status: 'queued', updated_at: new Date().toISOString() })
          .eq('id', migrationId);
        logger.info(`[watchdog] Migration ${migrationId} reset to 'queued' (no queue instance provided)`);
      }

      // Send confirmation email so user knows we received payment + are starting
      try {
        const { data: authData } = await supabaseAdmin.auth.admin.getUserById(migration.user_id);
        const userEmail = authData?.user?.email;
        const userName  = authData?.user?.user_metadata?.name
                       || authData?.user?.user_metadata?.full_name
                       || '';

        if (userEmail) {
          await sendMigrationStarting(userEmail, migration.repourl, migration.id, userName);
          logger.info(`[watchdog] Confirmation email sent to ${userEmail} for ${migrationId}`);
        }
      } catch (emailErr) {
        // Email failure is non-fatal
        logger.warn(`[watchdog] Email send failed for ${migrationId}: ${emailErr.message}`);
      }

    } catch (err) {
      // Watchdog must never crash the process
      logger.error(`[watchdog] Unexpected error for ${migrationId}: ${err.message}`);
    }
  }, WATCHDOG_DELAY_MS);
}

module.exports = { scheduleJobSafetyCheck };
