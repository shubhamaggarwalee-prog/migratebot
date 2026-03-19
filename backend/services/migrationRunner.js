/**
 * backend/services/migrationRunner.js
 * Real migration orchestration — Bull job processor
 * Replaces all fake setTimeout stubs with actual service calls.
 */
const { supabaseAdmin } = require('../utils/database');
const { sendMigrationComplete, sendMigrationFailed } = require('./email');
const { CodeAnalyzer } = require('../agent/analyzer');
const GitHubService = require('./github');
const SupabaseService = require('./supabase');
const RailwayService = require('./railway');
const VercelService = require('./vercel');
const StripeService = require('./stripe');
const { decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

// Lazy-load broadcastProgress to avoid circular dep at require-time
function broadcast(migrationId, payload) {
  try {
    const { broadcastProgress } = require('../../server');
    broadcastProgress(migrationId, payload);
  } catch (_) {
    // server not yet initialised in test env — ignore
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function log(ctx, level, message) {
  const safeLevel = ['info', 'warn', 'error', 'success'].includes(level) ? level : 'info';
  try {
    await supabaseAdmin.from('deploy_logs').insert([{
      migration_id: ctx.migrationId,
      level: safeLevel,
      message,
      timestamp: new Date().toISOString()
    }]);
  } catch (_) { /* non-fatal */ }
  broadcast(ctx.migrationId, { type: 'log', level: safeLevel, message, timestamp: Date.now() });
  const logFn = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info';
  logger[logFn](`[${ctx.migrationId.slice(0, 8)}] ${message}`);
}

async function updateStatus(ctx, status, extra = {}) {
  broadcast(ctx.migrationId, { type: 'status', status });
  await supabaseAdmin.from('migrations').update({
    status,
    updated_at: new Date().toISOString(),
    ...extra
  }).eq('id', ctx.migrationId);
}

async function loadCredentials(userId, platforms) {
  const { data } = await supabaseAdmin
    .from('credentials')
    .select('platform, encrypted_token, iv')
    .eq('user_id', userId)
    .in('platform', [...platforms, 'github']);
  const creds = {};
  for (const row of (data || [])) {
    creds[row.platform] = decrypt(row.encrypted_token, row.iv);
  }
  const missing = [...platforms, 'github'].filter(p => !creds[p]);
  if (missing.length) throw new Error(`Missing credentials for: ${missing.join(', ')}`);
  return creds;
}

function buildEnvVars(analysis, ctx) {
  const all = {};
  const vercel = {};
  const railway = {};

  if (ctx.supabaseProject) {
    all.SUPABASE_URL = ctx.supabaseProject.projectUrl;
    all.SUPABASE_ANON_KEY = ctx.supabaseProject.anonKey;
    all.SUPABASE_SERVICE_KEY = ctx.supabaseProject.serviceKey;
    all.DATABASE_URL = ctx.supabaseProject.dbUrl;
    vercel.NEXT_PUBLIC_SUPABASE_URL = ctx.supabaseProject.projectUrl;
    vercel.NEXT_PUBLIC_SUPABASE_ANON_KEY = ctx.supabaseProject.anonKey;
    railway.SUPABASE_URL = ctx.supabaseProject.projectUrl;
    railway.SUPABASE_SERVICE_KEY = ctx.supabaseProject.serviceKey;
    railway.DATABASE_URL = ctx.supabaseProject.dbUrl;
  }
  if (ctx.railwayUrl) {
    vercel.NEXT_PUBLIC_API_URL = ctx.railwayUrl;
    all.API_URL = ctx.railwayUrl;
  }
  railway.NODE_ENV = 'production';
  railway.PORT = '8080';

  return { all, vercel, railway };
}

async function runHealthChecks({ frontend, backend, database }) {
  const results = {};
  const checks = [
    { name: 'frontend', url: frontend ? `${frontend}` : null },
    { name: 'backend',  url: backend  ? `${backend}/api/health` : null },
    { name: 'database', url: database ? `${database}/rest/v1/` : null },
  ];
  for (const check of checks) {
    if (!check.url) { results[check.name] = 'skipped'; continue; }
    try {
      const res = await fetch(check.url, { signal: AbortSignal.timeout(10000) });
      results[check.name] = res.ok ? 'healthy' : `unhealthy (${res.status})`;
    } catch {
      results[check.name] = 'unreachable';
    }
  }
  return results;
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

async function runMigration(migration, job, io) {
  const { id: migrationId } = migration;
  const ctx = { migrationId, migration, io };

  try {
    // ── Boot ────────────────────────────────────────────────────────────────
    await updateStatus(ctx, 'running');
    await log(ctx, 'info', `🚀 Starting real migration for ${migration.repourl}`);
    if (job) await job.progress(5);

    // Load credentials
    ctx.creds = await loadCredentials(migration.user_id, migration.platforms);

    // ── Step 1: Clone + AI Analysis ──────────────────────────────────────────
    await log(ctx, 'info', 'Step 1/5 — Cloning repository and running AI analysis');
    broadcast(migrationId, { type: 'task-start', taskId: 'analyze', title: 'AI codebase analysis' });

    const github = new GitHubService(ctx.creds.github);
    const repoInfo = await github.getRepoInfo(migration.repourl);
    ctx.repoInfo = repoInfo;
    const files = await github.cloneAndReadFiles(migration.repourl, migration.repobranch || 'main');

    const analyzer = new CodeAnalyzer();
    const analysis = await analyzer.analyze(files, migration.platforms);
    ctx.analysis = analysis;

    await supabaseAdmin.from('migrations').update({ analysis }).eq('id', migrationId);
    await log(ctx, 'success', `✓ Analysis complete — ${analysis.framework} / ${analysis.language} detected, ${analysis.migrationTasks?.length || 0} tasks`);
    broadcast(migrationId, { type: 'task-done', taskId: 'analyze', result: { framework: analysis.framework } });
    if (job) await job.progress(20);

    // ── Step 2: Supabase ─────────────────────────────────────────────────────
    if (migration.platforms.includes('supabase')) {
      broadcast(migrationId, { type: 'task-start', taskId: 'supabase', title: 'Creating Supabase project' });
      await log(ctx, 'info', 'Step 2/5 — Creating Supabase project');

      const sb = new SupabaseService(ctx.creds.supabase);
      const projectName = `${repoInfo.name}-${Date.now()}`.slice(0, 40).toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const project = await sb.createProject({ name: projectName });
      ctx.supabaseProject = project;
      await log(ctx, 'info', `Supabase project created: ${project.projectId}`);

      if (analysis.supabaseSchema || analysis.databaseSchema) {
        const sql = analysis.supabaseSchema
          || await analyzer.generateSupabaseMigration(analysis.databaseSchema, analysis.databaseType);
        await sb.runMigration(project.projectId, sql);
        await log(ctx, 'info', `✓ Database schema migrated`);
      }

      await sb.configureAuth(project.projectId, {
        siteUrl: 'https://localhost:3000',
        redirectUrls: ['https://localhost:3000/auth/callback']
      });

      await log(ctx, 'success', `✓ Supabase ready: ${project.projectUrl}`);
      broadcast(migrationId, { type: 'task-done', taskId: 'supabase', result: { url: project.projectUrl } });
    }
    if (job) await job.progress(40);

    // ── Build env var map (needs supabaseProject populated first) ────────────
    ctx.envVars = buildEnvVars(analysis, ctx);

    // ── Step 3: Railway backend deploy ───────────────────────────────────────
    if (migration.platforms.includes('railway')) {
      broadcast(migrationId, { type: 'task-start', taskId: 'railway', title: 'Deploying backend to Railway' });
      await log(ctx, 'info', 'Step 3/5 — Deploying backend to Railway');

      const railway = new RailwayService(ctx.creds.railway);
      const project = await railway.createProject(repoInfo.name);
      const env = await railway.getEnvironment(project.id);
      const { owner, repo } = github.parseRepoUrl(migration.repourl);
      const service = await railway.createGithubService(project.id, env.id, {
        repoOwner: owner,
        repoName: repo,
        branch: migration.repobranch || 'main'
      });

      await railway.setEnvVars(project.id, env.id, service.id, ctx.envVars.railway);
      await railway.triggerDeploy(service.id, env.id);
      const result = await railway.waitForDeployment(service.id, env.id);
      ctx.railwayUrl = result.url;

      // Rebuild env vars now that railwayUrl is known (adds NEXT_PUBLIC_API_URL)
      ctx.envVars = buildEnvVars(analysis, ctx);

      await log(ctx, 'success', `✓ Railway live: ${result.url}`);
      broadcast(migrationId, { type: 'task-done', taskId: 'railway', result: { url: result.url } });
    }
    if (job) await job.progress(65);

    // ── Step 4: Vercel frontend deploy ───────────────────────────────────────
    if (migration.platforms.includes('vercel')) {
      broadcast(migrationId, { type: 'task-start', taskId: 'vercel', title: 'Deploying frontend to Vercel' });
      await log(ctx, 'info', 'Step 4/5 — Deploying frontend to Vercel');

      const vercel = new VercelService(ctx.creds.vercel);
      const { owner: repoOwner } = github.parseRepoUrl(migration.repourl);
      const project = await vercel.createProject({
        name: repoInfo.name,
        framework: analysis.framework,
        gitRepo: `${repoOwner}/${repoInfo.name}`
      });

      const envArray = Object.entries({
        ...ctx.envVars.vercel,
        ...(ctx.railwayUrl ? { NEXT_PUBLIC_API_URL: ctx.railwayUrl } : {})
      }).map(([key, value]) => ({ key, value }));
      await vercel.setEnvVars(project.projectId, envArray);

      const deploymentId = await vercel.createDeploymentFromGit(project.projectId, {
        branch: migration.repobranch || 'main'
      });
      const deployResult = await vercel.waitForDeployment(deploymentId);
      ctx.vercelUrl = deployResult.url;

      // Update Supabase auth redirect now we know the real URL
      if (ctx.supabaseProject) {
        const sb = new SupabaseService(ctx.creds.supabase);
        await sb.configureAuth(ctx.supabaseProject.projectId, {
          siteUrl: ctx.vercelUrl,
          redirectUrls: [`${ctx.vercelUrl}/auth/callback`]
        });
      }

      await log(ctx, 'success', `✓ Vercel live: ${deployResult.url}`);
      broadcast(migrationId, { type: 'task-done', taskId: 'vercel', result: { url: deployResult.url } });
    }
    if (job) await job.progress(85);

    // ── Step 5: Health checks ────────────────────────────────────────────────
    broadcast(migrationId, { type: 'task-start', taskId: 'health', title: 'Running health checks' });
    await log(ctx, 'info', 'Step 5/5 — Running health checks');
    const healthResults = await runHealthChecks({
      frontend: ctx.vercelUrl,
      backend:  ctx.railwayUrl,
      database: ctx.supabaseProject?.projectUrl
    });
    const allHealthy = Object.values(healthResults).every(v => v === 'healthy' || v === 'skipped');
    await log(ctx, allHealthy ? 'success' : 'warn',
      `Health checks: ${JSON.stringify(healthResults)}`);
    broadcast(migrationId, { type: 'task-done', taskId: 'health', result: healthResults });

    // ── Complete ─────────────────────────────────────────────────────────────
    const deployedUrls = {
      frontend: ctx.vercelUrl  || null,
      backend:  ctx.railwayUrl || null,
      database: ctx.supabaseProject?.projectUrl || null
    };
    await updateStatus(ctx, 'complete', {
      deployed_urls: deployedUrls,
      completed_at: new Date().toISOString(),
      duration_seconds: Math.floor((Date.now() - new Date(migration.created_at).getTime()) / 1000)
    });
    await log(ctx, 'success', '🎉 Migration complete!');
    broadcast(migrationId, { type: 'complete', status: 'complete', deployedUrls });
    if (job) await job.progress(100);

    // Fire-and-forget success email
    try {
      const { data: user } = await supabaseAdmin.auth.admin.getUserById(migration.user_id);
      if (user?.user?.email) {
        await sendMigrationComplete(
          user.user.email,
          repoInfo.name,
          process.env.FRONTEND_URL || ''
        );
      }
    } catch (_) { /* email failure must never break migration */ }

  } catch (err) {
    logger.error(`Migration ${migrationId} failed: ${err.message}`, err.stack);
    await log(ctx, 'error', `❌ Migration failed: ${err.message}`);
    await updateStatus(ctx, 'failed', {
      error_message: err.message,
      completed_at: new Date().toISOString()
    });
    broadcast(migrationId, { type: 'error', status: 'failed', error: err.message });

    // ── Auto-refund on failure ───────────────────────────────────────────────
    if (ctx.migration?.stripe_payment_intent_id) {
      try {
        const stripe = new StripeService();
        await stripe.refundByPaymentIntent(ctx.migration.stripe_payment_intent_id, 'other');
        await updateStatus(ctx, 'refunded');
        await log(ctx, 'info', '💰 Payment automatically refunded due to migration failure');
        broadcast(migrationId, { type: 'refund', message: 'Payment automatically refunded due to migration failure' });
      } catch (refundErr) {
        logger.error(`Auto-refund failed for ${migrationId}: ${refundErr.message}`);
      }
    }

    // Fire-and-forget failure email
    try {
      const { data: user } = await supabaseAdmin.auth.admin.getUserById(migration.user_id);
      if (user?.user?.email && sendMigrationFailed) {
        await sendMigrationFailed(
          user.user.email,
          repoInfo?.name || migration.repourl,
          err.message
        );
      }
    } catch (_) { /* ignore */ }

    throw err;
  }
}

module.exports = { runMigration };
