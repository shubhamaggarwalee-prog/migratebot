/**
 * backend/utils/queue.js
 * Bull job queue for background migration jobs
 */
const Bull = require('bull');
const { runMigration } = require('../services/migrationRunner');

let migrationQueue;

async function initQueue(io) {
  migrationQueue = new Bull('migrations', process.env.REDIS_URL);

  migrationQueue.process(async (job) => {
    const { migration } = job.data;
    await runMigration(migration, job, io);
  });

  migrationQueue.on('completed', (job) => {
    console.log(`Migration job ${job.id} completed`);
    if (io) io.to(`migration:${job.data.migration.id}`).emit('migration:complete', { migrationId: job.data.migration.id });
  });

  migrationQueue.on('failed', (job, err) => {
    console.error(`Migration job ${job.id} failed:`, err.message);
    if (io) io.to(`migration:${job.data.migration.id}`).emit('migration:error', { error: err.message });
  });

  migrationQueue.on('progress', (job, progress) => {
    if (io) io.to(`migration:${job.data.migration.id}`).emit('migration:progress', { progress, step: job.data.step });
  });

  console.log('Bull queue initialized');
  return migrationQueue;
}

async function addMigrationJob(migration) {
  return migrationQueue.add({ migration }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
}

function getQueue() {
  return migrationQueue;
}

module.exports = { initQueue, addMigrationJob, getQueue };
