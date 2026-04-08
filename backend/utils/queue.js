/**
 * backend/utils/queue.js
 * Bull job queue for background migration jobs.
 *
 * Deploy-blocker fix: two issues resolved.
 *
 * 1. REDIS_URL guard — Bull connects to Redis eagerly at new Bull() time.
 *    If REDIS_URL is missing the process crashed before serving any request.
 *    We now check for REDIS_URL before initialising Bull and log a clear
 *    warning instead of throwing.
 *
 * 2. initQueue() was never called from server.js — migrationQueue was always
 *    undefined, so addMigrationJob() would throw on every migration attempt.
 *    server.js now calls initQueue(io) in the listen() callback.
 */
const Bull            = require('bull');
const { runMigration } = require('../services/migrationRunner');
const logger          = require('./logger');

let migrationQueue = null;

/**
 * Initialise the Bull queue and wire up event handlers.
 * Called once from server.js after the HTTP server starts listening.
 * Safe to call when REDIS_URL is absent — logs a warning and returns null.
 *
 * Note on Redis options (Bull v4 + ioredis):
 * Bull uses blocking commands on its internal bclient/subscriber connections.
 * To avoid connection hangs and to comply with Bull's safety checks, we must
 * explicitly set maxRetriesPerRequest to null and disable the ready check.
 * See: https://github.com/OptimalBits/bull/issues/2186
 *
 * @param {import('socket.io').Server} io
 * @returns {Bull.Queue|null}
 */
async function initQueue(io) {
  if (!process.env.REDIS_URL) {
    logger.warn(
      'REDIS_URL is not set — Bull queue not initialised. ' +
      'Migrations will return 503 until Redis is provisioned.'
    );
    return null;
  }

  try {
    migrationQueue = new Bull('migrations', process.env.REDIS_URL, {
      redis: {
        // Fail fast rather than hanging indefinitely if Redis is unreachable
        connectTimeout: 5000,
        // Required for Bull + ioredis so blocking commands work reliably.
        // Setting these to truthy values causes "MISSING_REDIS_OPTS" crashes.
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
    });

    migrationQueue.process(async (job) => {
      const { migration } = job.data;
      await runMigration(migration, job, io);
    });

    migrationQueue.on('completed', (job) => {
      logger.info(`Migration job ${job.id} completed`);
      if (io) io.to(`migration:${job.data.migration.id}`).emit('migration:complete', { migrationId: job.data.migration.id });
    });

    migrationQueue.on('failed', (job, err) => {
      logger.error(`Migration job ${job.id} failed: ${err.message}`, { stack: err.stack });
      if (io) io.to(`migration:${job.data.migration.id}`).emit('migration:error', { error: err.message });
    });

    migrationQueue.on('progress', (job, progress) => {
      if (io) io.to(`migration:${job.data.migration.id}`).emit('migration:progress', { progress, step: job.data.step });
    });

    migrationQueue.on('error', (err) => {
      // Prevent unhandled 'error' event from crashing the process
      logger.error('Bull queue error:', { message: err.message, stack: err.stack });
    });

    logger.info('Bull migration queue initialised successfully');
    return migrationQueue;
  } catch (err) {
    // Catch synchronous errors from new Bull() (e.g. malformed REDIS_URL)
    logger.error('Failed to initialise Bull queue:', { message: err.message, stack: err.stack });
    migrationQueue = null;
    return null;
  }
}

/**
 * Add a migration job to the queue.
 * Returns { queued: false, error } if the queue was never initialised
 * so callers can return a 503 instead of crashing.
 *
 * @param {object} migration
 */
async function addMigrationJob(migration) {
  if (!migrationQueue) {
    return { queued: false, error: 'Migration queue is not available. Redis may not be provisioned.' };
  }
  const job = await migrationQueue.add(
    { migration },
    { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
  );
  return { queued: true, jobId: job.id };
}

function getQueue() {
  return migrationQueue;
}

module.exports = { initQueue, addMigrationJob, getQueue };
