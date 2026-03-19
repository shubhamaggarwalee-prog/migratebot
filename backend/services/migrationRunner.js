/**
 * backend/services/migrationRunner.js
 * Core migration orchestration — runs inside Bull job
 */
const { supabaseAdmin } = require('../utils/supabase');
const { sendMigrationComplete } = require('../utils/sendgrid');

async function log(io, migrationId, message, level = 'info') {
  await supabaseAdmin.from('deploy_logs').insert([{ migration_id: migrationId, message, level }]);
  if (io) io.to(`migration:${migrationId}`).emit('migration:log', { message, level, timestamp: new Date() });
  console.log(`[${level.toUpperCase()}] [${migrationId}] ${message}`);
}

async function updateStatus(migrationId, status, extra = {}) {
  await supabaseAdmin.from('migrations').update({ status, updated_at: new Date().toISOString(), ...extra }).eq('id', migrationId);
}

async function runMigration(migration, job, io) {
  const { id: migrationId } = migration;

  try {
    // Step 1: Prepare
    await updateStatus(migrationId, 'deploying');
    await log(io, migrationId, `Starting migration for ${migration.repourl}`);
    await job.progress(10);

    // Step 2: Clone / fetch source
    await log(io, migrationId, `Fetching source from ${migration.source_platform}...`);
    await job.progress(25);

    // Step 3: Deploy to Vercel
    await log(io, migrationId, 'Deploying frontend to Vercel...');
    await new Promise(r => setTimeout(r, 2000)); // Replace with actual Vercel deploy
    await log(io, migrationId, '✓ Vercel deployment initiated');
    await job.progress(50);

    // Step 4: Deploy to Railway
    await log(io, migrationId, 'Deploying backend to Railway...');
    await new Promise(r => setTimeout(r, 2000)); // Replace with actual Railway deploy
    await log(io, migrationId, '✓ Railway deployment initiated');
    await job.progress(75);

    // Step 5: Finalize
    await log(io, migrationId, 'Finalizing migration...');
    await updateStatus(migrationId, 'complete');
    await log(io, migrationId, '🎉 Migration complete!', 'success');
    await job.progress(100);

    // Email notification
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(migration.user_id).catch(() => ({ data: null }));
    if (user?.user?.email) {
      await sendMigrationComplete(user.user.email, migration.reponame || migration.repourl, process.env.FRONTEND_URL || '');
    }

  } catch (err) {
    await log(io, migrationId, `Error: ${err.message}`, 'error');
    await updateStatus(migrationId, 'failed', { error_message: err.message });
    throw err;
  }
}

module.exports = { runMigration };
