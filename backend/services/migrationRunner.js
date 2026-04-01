/**
 * backend/services/migrationRunner.js
 * Real migration orchestration — Bull job processor.
 * Supports source platforms: github | replit | emergent | url (bare git)
 *
 * Task 17: Updated fire-and-forget email blocks to pass deployedUrls,
 *          migrationId, and user name so the rich email templates have
 *          all the data they need.
 * Task 19: Wired MigrationAgent — preScan after analysis, autoFix loop
 *          around each deployment step (supabase / railway / vercel).
 * Fix 3:   Verify Replit project access before cloning; show actionable
 *          error if access fails and no token was provided.
 * Fix 5:   DB safety check — skip Supabase if no database detected in
 *          the codebase; tell the user plainly what happened.
 * Fix 6:   Partial deploy failure — if Railway succeeds but Vercel fails
 *          (or vice versa), do NOT mark the migration complete. Record
 *          which step failed, broadcast a plain-English explanation plus
 *          a retry-step event so the frontend can show a retry button.
 */
const { supabaseAdmin } = require('../utils/database');
const { sendMigrationComplete, sendMigrationFailed } = require('./email');
const { CodeAnalyzer } = require('../agent/analyzer');
const GitHubService    = require('./github');
const ReplitService    = require('./replit');
const SupabaseService  = require('./supabase');
const RailwayService   = require('./railway');
const VercelService    = require('./vercel');
const StripeService    = require('./stripe');
const MigrationAgent   = require('./migrationAgent');
const { decrypt }      = require('../utils/encryption');
const logger           = require('../utils/logger');

// Broadcast progress to all sockets subscribed to a migration room.
function broadcast(io, migrationId, payload) {
  if (io) io.to(`migration:${migrationId}`).emit('migration:progress', payload);
}

// ─── Helpers ───────────────────────────────────────────────────────────────────────────────

async function log(io, ctx, level, message) {
  const safeLevel = ['info', 'warn', 'error', 'success'].includes(level) ? level : 'info';
  try {
    await supabaseAdmin.from('deploy_logs').insert([{
      migration_id: ctx.migrationId,
      level: safeLevel,
      message,
      timestamp: new Date().toISOString()
    }]);
  } catch (_) { /* non-fatal */ }
  broadcast(io, ctx.migrationId, { type: 'log', level: safeLevel, message, timestamp: Date.now() });
  logger[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info'](
    `[${ctx.migrationId.slice(0, 8)}] ${message}`
  );
}

async function updateStatus(io, ctx, status, extra = {}) {
  broadcast(io, ctx.migrationId, { type: 'status', status });
  await supabaseAdmin.from('migrations').update({
    status,
    updated_at: new Date().toISOString(),
    ...extra
  }).eq('id', ctx.migrationId);
}

async function loadCredentials(userId, platforms, sourcePlatform) {
  const needGithub = !['replit', 'emergent'].includes(sourcePlatform);
  const wantedPlatforms = [
    ...platforms,
    ...(needGithub ? ['github'] : []),
    ...(sourcePlatform === 'replit' ? ['replit'] : []),
  ];
  const uniquePlatforms = [...new Set(wantedPlatforms)];

  const { data } = await supabaseAdmin
    .from('credentials')
    .select('platform, encrypted_data')
    .eq('user_id', userId)
    .in('platform', uniquePlatforms);

  const creds = {};
  for (const row of (data || [])) {
    try {
      const parsed = JSON.parse(decrypt(row.encrypted_data));
      creds[row.platform] = parsed.token || parsed.key || parsed;
    } catch {
      creds[row.platform] = decrypt(row.encrypted_data);
    }
  }

  const missing = uniquePlatforms.filter(p => {
    if (p === 'replit') return false;
    return !creds[p];
  });
  if (missing.length) throw new Error(`Missing credentials for: ${missing.join(', ')}`);
  return creds;
}

function buildEnvVars(analysis, ctx) {
  const all = {};
  const vercel = {};
  const railway = {};

  if (ctx.supabaseProject) {
    all.SUPABASE_URL             = ctx.supabaseProject.projectUrl;
    all.SUPABASE_ANON_KEY        = ctx.supabaseProject.anonKey;
    all.SUPABASE_SERVICE_KEY     = ctx.supabaseProject.serviceKey;
    all.DATABASE_URL             = ctx.supabaseProject.dbUrl;
    vercel.NEXT_PUBLIC_SUPABASE_URL      = ctx.supabaseProject.projectUrl;
    vercel.NEXT_PUBLIC_SUPABASE_ANON_KEY = ctx.supabaseProject.anonKey;
    railway.SUPABASE_URL         = ctx.supabaseProject.projectUrl;
    railway.SUPABASE_SERVICE_KEY = ctx.supabaseProject.serviceKey;
    railway.DATABASE_URL         = ctx.supabaseProject.dbUrl;
  }
  if (ctx.railwayUrl) {
    vercel.NEXT_PUBLIC_API_URL = ctx.railwayUrl;
    all.API_URL                = ctx.railwayUrl;
  }
  railway.NODE_ENV = 'production';
  railway.PORT     = '8080';
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

// ─── Fix 5: Detect whether a project has a database ──────────────────────────────────────

const DB_DEPS = new Set([
  'pg', 'postgres', 'mysql', 'mysql2', 'mongoose', 'mongodb',
  'sequelize', 'prisma', 'typeorm', 'knex', 'supabase', '@supabase/supabase-js',
  'better-sqlite3', 'sqlite3', 'redis', 'ioredis', 'drizzle-orm',
]);

function projectHasDatabase(analysis) {
  if (analysis.databaseSchema)  return true;
  if (analysis.supabaseSchema)  return true;
  if (analysis.databaseType)    return true;
  if (analysis.hasDatabase)     return true;

  const deps = {
    ...(analysis.dependencies        || {}),
    ...(analysis.devDependencies     || {}),
    ...(analysis.peerDependencies    || {}),
  };
  return Object.keys(deps).some(dep => DB_DEPS.has(dep));
}

// ─── Task 19: Agent step wrapper ─────────────────────────────────────────────────────────────

async function runStepWithAgentRetry(stepFn, stepName, agent, context, logFn) {
  try {
    return await stepFn();
  } catch (firstErr) {
    await logFn('warn', `⚠️ ${stepName} step failed — asking MigrationAgent for a fix…`);

    let fix;
    try {
      fix = await agent.autoFix(firstErr.message, stepName, context);
    } catch (agentErr) {
      logger.warn(`MigrationAgent.autoFix threw: ${agentErr.message}`);
      throw firstErr;
    }

    if (fix.action === 'fix') {
      await logFn('info', `🧠 Agent applied a patch — retrying ${stepName}…`);
      return await stepFn();
    }

    throw new Error(
      `Migration paused at ${stepName} step — agent needs user input. ` +
      `Check the deployment page to continue.`
    );
  }
}

// ─── Fix 6: Broadcast a retryable step failure ────────────────────────────────────────────

/**
 * Maps a raw step error to a plain-English user message.
 */
function stepFailureMessage(stepName, err) {
  const m = (err.message || '').toLowerCase();

  if (stepName === 'railway') {
    if (m.includes('token') || m.includes('unauthorized') || m.includes('401'))
      return 'Your Railway token appears to be invalid. Please check your credentials in Settings and try again.';
    if (m.includes('timeout') || m.includes('timed out'))
      return 'The Railway deployment timed out. This can happen with large projects. Please retry.';
    return 'The backend deployment to Railway failed. Your frontend (if any) was not affected. Please retry the Railway step.';
  }

  if (stepName === 'vercel') {
    if (m.includes('token') || m.includes('unauthorized') || m.includes('401'))
      return 'Your Vercel token appears to be invalid. Please check your credentials in Settings and try again.';
    if (m.includes('build') || m.includes('compile'))
      return 'The Vercel build failed. This is usually a code issue. Check the build logs and retry.';
    if (m.includes('timeout') || m.includes('timed out'))
      return 'The Vercel deployment timed out. Please retry.';
    return 'The frontend deployment to Vercel failed. Your backend (if any) is still live. Please retry the Vercel step.';
  }

  if (stepName === 'supabase') {
    return 'The database setup on Supabase failed. Your other deployments were not affected. Please retry the Supabase step.';
  }

  return `The ${stepName} step failed. Please retry it from the deployment page.`;
}

/**
 * Records a step failure in the DB, broadcasts a plain-English explanation
 * and a retry-step event so the frontend can show a retry button.
 */
async function recordStepFailure(io, ctx, stepName, err) {
  const userMessage = stepFailureMessage(stepName, err);

  await log(io, ctx.migrationId, { type: 'log', level: 'error', message: `❌ ${userMessage}` });

  // Store the failed step so the frontend knows what to offer a retry for
  try {
    await supabaseAdmin.from('migrations').update({
      failed_step:   stepName,
      error_message: userMessage,
      updated_at:    new Date().toISOString(),
    }).eq('id', ctx.migrationId);
  } catch (_) { /* non-fatal */ }

  broadcast(io, ctx.migrationId, {
    type:        'step-failed',
    stepName,
    message:     userMessage,
    retryable:   true,
  });
}

// ─── Source adapters ─────────────────────────────────────────────────────────────────────────────

async function cloneFromGitHub(migration, creds, ctx) {
  const github   = new GitHubService(creds.github);
  const repoInfo = await github.getRepoInfo(migration.repourl);
  const files    = await github.cloneAndReadFiles(migration.repourl, migration.repobranch || 'main');
  ctx.github = github;
  return { files, repoInfo };
}

async function cloneFromReplit(migration, creds, ctx) {
  const token = creds.replit || ctx.replitToken || null;

  try {
    const replit = new ReplitService(token);
    await replit.getUser();
    const { username: parsedUser, slug } = replit.parseReplUrl(migration.repourl);

    const user     = await replit.getUser();
    const username = parsedUser || user.username;
    await replit.getReplInfo(username, slug);

    const replInfo = await replit.getReplInfo(username, slug);
    const files    = await replit.readFiles(username, slug);
    ctx.replit = replit;
    return {
      files,
      repoInfo: {
        name:          replInfo.slug,
        fullName:      `@${username}/${replInfo.slug}`,
        defaultBranch: 'main',
        language:      replInfo.language,
        description:   replInfo.description,
      },
    };
  } catch (err) {
    const isAccessError =
      err.message?.toLowerCase().includes('403') ||
      err.message?.toLowerCase().includes('401') ||
      err.message?.toLowerCase().includes('forbidden') ||
      err.message?.toLowerCase().includes('unauthorized') ||
      err.message?.toLowerCase().includes('not found') ||
      err.message?.toLowerCase().includes('404') ||
      err.message?.toLowerCase().includes('private');

    if (isAccessError && !token) {
      throw new Error(
        'We could not access your Replit project. ' +
        'If it is private please add your Replit token in the setup step.'
      );
    }
    throw err;
  }
}

async function cloneFromUrl(migration, creds, ctx) {
  const token  = creds.github || '';
  const github = new GitHubService(token);
  const files  = await github.cloneAndReadFiles(migration.repourl, migration.repobranch || 'main');
  const slug   = migration.repourl.split('/').pop().replace(/\.git$/, '') || 'project';
  ctx.github   = github;
  return {
    files,
    repoInfo: { name: slug, fullName: migration.repourl, defaultBranch: migration.repobranch || 'main' },
  };
}

const cloneFromEmergent = cloneFromUrl;

async function cloneSource(migration, creds, ctx) {
  const src = (migration.source_platform || 'github').toLowerCase();
  switch (src) {
    case 'replit':   return cloneFromReplit(migration, creds, ctx);
    case 'emergent': return cloneFromEmergent(migration, creds, ctx);
    case 'url':      return cloneFromUrl(migration, creds, ctx);
    case 'github':
    default:         return cloneFromGitHub(migration, creds, ctx);
  }
}

// ─── Main orchestrator ────────────────────────────────────────────────────────────────────────

async function runMigration(migration, job, io) {
  const { id: migrationId } = migration;
  const ctx = { migrationId, migration };

  if (job?.data?.replitToken) ctx.replitToken = job.data.replitToken;

  try {
    await updateStatus(io, ctx, 'running');
    await log(io, ctx, 'info', `🚀 Starting migration for ${migration.repourl} [source: ${migration.source_platform || 'github'}]`);
    if (job) await job.progress(5);

    ctx.creds = await loadCredentials(migration.user_id, migration.platforms, migration.source_platform);

    // ── Step 1: Clone + AI Analysis ────────────────────────────────────────────────
    await log(io, ctx, 'info', 'Step 1/5 — Cloning repository and running AI analysis');
    broadcast(io, migrationId, { type: 'task-start', taskId: 'analyze', title: 'AI codebase analysis' });

    const { files, repoInfo } = await cloneSource(migration, ctx.creds, ctx);
    ctx.repoInfo = repoInfo;

    const analyzer = new CodeAnalyzer();
    const analysis = await analyzer.analyze(files, migration.platforms);
    ctx.analysis = analysis;

    await supabaseAdmin.from('migrations').update({ analysis }).eq('id', migrationId);
    await log(io, ctx, 'success',
      `✓ Analysis complete — ${analysis.framework} / ${analysis.language} detected, ${analysis.migrationTasks?.length || 0} tasks`);
    broadcast(io, migrationId, { type: 'task-done', taskId: 'analyze', result: { framework: analysis.framework } });
    if (job) await job.progress(20);

    // ── Task 19: MigrationAgent preScan ─────────────────────────────────────────
    let agent = null;
    try {
      const { data: credRow } = await supabaseAdmin
        .from('credentials')
        .select('encrypted_data')
        .eq('migration_id', migrationId)
        .eq('user_id', migration.user_id)
        .eq('platform', 'anthropic')
        .maybeSingle();

      if (credRow) {
        const parsed       = JSON.parse(decrypt(credRow.encrypted_data));
        const anthropicKey = parsed.token || parsed.anthropicKey || '';
        if (anthropicKey) {
          agent = new MigrationAgent(anthropicKey, io, migrationId);
          await agent.preScan(files, analysis);
          await log(io, ctx, 'info', '🧠 Agent pre-scan complete — health report sent to frontend');
        }
      }
    } catch (agentInitErr) {
      logger.warn(`MigrationAgent init/preScan failed: ${agentInitErr.message}`);
    }
    ctx.agent = agent;

    const logFn = (level, msg) => log(io, ctx, level, msg);

    // ── Fix 5: DB safety check ────────────────────────────────────────────────────
    let activePlatforms = [...migration.platforms];
    if (activePlatforms.includes('supabase') && !projectHasDatabase(analysis)) {
      await log(io, ctx, 'info',
        'ℹ️ We did not find a database in your project so we skipped that step.');
      broadcast(io, migrationId, {
        type:   'task-skipped',
        taskId: 'supabase',
        reason: 'No database detected in the project.',
      });
      activePlatforms = activePlatforms.filter(p => p !== 'supabase');
    }

    // ── Fix 6: Per-step failure tracking ─────────────────────────────────────────
    // stepResults tracks which deployment steps succeeded / failed.
    // A migration is only marked 'complete' if ALL attempted steps succeed.
    const stepResults = {};   // { supabase: 'ok'|'failed', railway: 'ok'|'failed', vercel: 'ok'|'failed' }

    // ── Step 2: Supabase ─────────────────────────────────────────────────────────────
    if (activePlatforms.includes('supabase')) {
      broadcast(io, migrationId, { type: 'task-start', taskId: 'supabase', title: 'Creating Supabase project' });
      await log(io, ctx, 'info', 'Step 2/5 — Creating Supabase project');

      const supabaseStepFn = async () => {
        const sb          = new SupabaseService(ctx.creds.supabase);
        const projectName = `${repoInfo.name}-${Date.now()}`.slice(0, 40).toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const project     = await sb.createProject({ name: projectName });
        ctx.supabaseProject = project;
        await log(io, ctx, 'info', `Supabase project created: ${project.projectId}`);

        if (analysis.supabaseSchema || analysis.databaseSchema) {
          const sql = analysis.supabaseSchema
            || await analyzer.generateSupabaseMigration(analysis.databaseSchema, analysis.databaseType);
          await sb.runMigration(project.projectId, sql);
          await log(io, ctx, 'info', '✓ Database schema migrated');
        }

        await sb.configureAuth(project.projectId, {
          siteUrl:      'https://localhost:3000',
          redirectUrls: ['https://localhost:3000/auth/callback'],
        });

        await log(io, ctx, 'success', `✓ Supabase ready: ${project.projectUrl}`);
        broadcast(io, migrationId, { type: 'task-done', taskId: 'supabase', result: { url: project.projectUrl } });
      };

      try {
        if (agent) {
          await runStepWithAgentRetry(supabaseStepFn, 'supabase', agent, {}, logFn);
        } else {
          await supabaseStepFn();
        }
        stepResults.supabase = 'ok';
      } catch (stepErr) {
        stepResults.supabase = 'failed';
        await recordStepFailure(io, ctx, 'supabase', stepErr);
        logger.error(`Supabase step failed for ${migrationId}: ${stepErr.message}`);
        // Continue — don't abort; other steps may still succeed
      }
    }
    if (job) await job.progress(40);

    ctx.envVars = buildEnvVars(analysis, ctx);

    // ── Step 3: Railway ─────────────────────────────────────────────────────────────
    if (activePlatforms.includes('railway')) {
      broadcast(io, migrationId, { type: 'task-start', taskId: 'railway', title: 'Deploying backend to Railway' });
      await log(io, ctx, 'info', 'Step 3/5 — Deploying backend to Railway');

      const railwayStepFn = async () => {
        const railway = new RailwayService(ctx.creds.railway);
        const project = await railway.createProject(repoInfo.name);
        const env     = await railway.getEnvironment(project.id);

        let repoOwner, repoName;
        if (ctx.github) {
          ({ owner: repoOwner, repo: repoName } = ctx.github.parseRepoUrl(migration.repourl));
        } else {
          repoOwner = 'migratebot';
          repoName  = repoInfo.name;
          await log(io, ctx, 'warn',
            'Non-GitHub source detected — Railway deploy requires a GitHub repo. '
            + 'Auto-push to temp repo is a planned enhancement.');
        }

        const service = await railway.createGithubService(project.id, env.id, {
          repoOwner, repoName, branch: migration.repobranch || 'main',
        });
        await railway.setEnvVars(project.id, env.id, service.id, ctx.envVars.railway);
        await railway.triggerDeploy(service.id, env.id);
        const result = await railway.waitForDeployment(service.id, env.id);
        ctx.railwayUrl = result.url;

        ctx.envVars = buildEnvVars(analysis, ctx);
        await log(io, ctx, 'success', `✓ Railway live: ${result.url}`);
        broadcast(io, migrationId, { type: 'task-done', taskId: 'railway', result: { url: result.url } });
      };

      try {
        if (agent) {
          await runStepWithAgentRetry(railwayStepFn, 'railway', agent,
            { repoUrl: migration.repourl }, logFn);
        } else {
          await railwayStepFn();
        }
        stepResults.railway = 'ok';
      } catch (stepErr) {
        stepResults.railway = 'failed';
        await recordStepFailure(io, ctx, 'railway', stepErr);
        logger.error(`Railway step failed for ${migrationId}: ${stepErr.message}`);
        // Continue — Vercel can still deploy even if Railway failed
      }
    }
    if (job) await job.progress(65);

    // ── Step 4: Vercel ─────────────────────────────────────────────────────────────
    if (activePlatforms.includes('vercel')) {
      broadcast(io, migrationId, { type: 'task-start', taskId: 'vercel', title: 'Deploying frontend to Vercel' });
      await log(io, ctx, 'info', 'Step 4/5 — Deploying frontend to Vercel');

      const vercelStepFn = async () => {
        const vercel    = new VercelService(ctx.creds.vercel);
        const repoOwner = ctx.github
          ? ctx.github.parseRepoUrl(migration.repourl).owner
          : 'migratebot';
        const project   = await vercel.createProject({
          name:      repoInfo.name,
          framework: analysis.framework,
          gitRepo:   `${repoOwner}/${repoInfo.name}`,
        });

        const envArray = Object.entries({
          ...ctx.envVars.vercel,
          ...(ctx.railwayUrl ? { NEXT_PUBLIC_API_URL: ctx.railwayUrl } : {}),
        }).map(([key, value]) => ({ key, value }));
        await vercel.setEnvVars(project.projectId, envArray);

        const deploymentId = await vercel.createDeploymentFromGit(project.projectId, {
          branch: migration.repobranch || 'main',
        });
        const deployResult = await vercel.waitForDeployment(deploymentId);
        ctx.vercelUrl = deployResult.url;

        if (ctx.supabaseProject) {
          const sb = new SupabaseService(ctx.creds.supabase);
          await sb.configureAuth(ctx.supabaseProject.projectId, {
            siteUrl:      ctx.vercelUrl,
            redirectUrls: [`${ctx.vercelUrl}/auth/callback`],
          });
        }

        await log(io, ctx, 'success', `✓ Vercel live: ${deployResult.url}`);
        broadcast(io, migrationId, { type: 'task-done', taskId: 'vercel', result: { url: deployResult.url } });
      };

      try {
        if (agent) {
          await runStepWithAgentRetry(vercelStepFn, 'vercel', agent,
            { framework: analysis.framework }, logFn);
        } else {
          await vercelStepFn();
        }
        stepResults.vercel = 'ok';
      } catch (stepErr) {
        stepResults.vercel = 'failed';
        await recordStepFailure(io, ctx, 'vercel', stepErr);
        logger.error(`Vercel step failed for ${migrationId}: ${stepErr.message}`);
      }
    }
    if (job) await job.progress(85);

    // ── Step 5: Health checks ───────────────────────────────────────────────────────────
    broadcast(io, migrationId, { type: 'task-start', taskId: 'health', title: 'Running health checks' });
    await log(io, ctx, 'info', 'Step 5/5 — Running health checks');
    const healthResults = await runHealthChecks({
      frontend: ctx.vercelUrl,
      backend:  ctx.railwayUrl,
      database: ctx.supabaseProject?.projectUrl,
    });
    const allHealthy = Object.values(healthResults).every(v => v === 'healthy' || v === 'skipped');
    await log(io, ctx, allHealthy ? 'success' : 'warn', `Health checks: ${JSON.stringify(healthResults)}`);
    broadcast(io, migrationId, { type: 'task-done', taskId: 'health', result: healthResults });

    // ── Fix 6: Determine final status based on per-step results ──────────────────
    const failedSteps = Object.entries(stepResults)
      .filter(([, result]) => result === 'failed')
      .map(([step]) => step);

    const deployedUrls = {
      frontend: ctx.vercelUrl                   || null,
      backend:  ctx.railwayUrl                  || null,
      database: ctx.supabaseProject?.projectUrl || null,
    };

    if (failedSteps.length > 0) {
      // Some steps failed — mark as partial_failure, not complete
      await updateStatus(io, ctx, 'partial_failure', {
        deployed_urls:  deployedUrls,
        failed_step:    failedSteps.join(', '),
        completed_at:   new Date().toISOString(),
        duration_seconds: Math.floor((Date.now() - new Date(migration.created_at).getTime()) / 1000),
      });

      const failedList = failedSteps.join(' and ');
      await log(io, ctx, 'warn',
        `⚠️ Migration finished with issues — the ${failedList} step${failedSteps.length > 1 ? 's' : ''} did not complete. ` +
        `Everything else deployed successfully. You can retry the failed ${failedSteps.length > 1 ? 'steps' : 'step'} from the deployment page.`
      );
      broadcast(io, migrationId, {
        type:        'partial-complete',
        status:      'partial_failure',
        deployedUrls,
        failedSteps,
      });
    } else {
      // All steps succeeded
      await updateStatus(io, ctx, 'complete', {
        deployed_urls:    deployedUrls,
        completed_at:     new Date().toISOString(),
        duration_seconds: Math.floor((Date.now() - new Date(migration.created_at).getTime()) / 1000),
      });
      await log(io, ctx, 'success', '🎉 Migration complete!');
      broadcast(io, migrationId, { type: 'complete', status: 'complete', deployedUrls });
    }

    if (job) await job.progress(100);

    // ── Fire-and-forget success/partial email (Task 17) ──────────────────────────
    try {
      const { data: authData } = await supabaseAdmin.auth.admin.getUserById(migration.user_id);
      const userEmail = authData?.user?.email;
      const userName  = authData?.user?.user_metadata?.name || authData?.user?.user_metadata?.full_name || '';
      if (userEmail) {
        await sendMigrationComplete(
          userEmail,
          repoInfo.name,
          deployedUrls,
          migrationId,
          userName,
        );
      }
    } catch (_) { /* email failure must never break migration */ }

  } catch (err) {
    logger.error(`Migration ${migrationId} failed: ${err.message}`, err.stack);
    await log(io, ctx, 'error', `❌ Migration failed: ${err.message}`);
    await updateStatus(io, ctx, 'failed', {
      error_message: err.message,
      completed_at:  new Date().toISOString(),
    });
    broadcast(io, migrationId, { type: 'error', status: 'failed', error: err.message });

    // Auto-refund on hard failure (not partial)
    if (ctx.migration?.stripe_payment_intent_id) {
      try {
        const stripe = new StripeService();
        await stripe.refundByPaymentIntent(ctx.migration.stripe_payment_intent_id, 'other');
        await updateStatus(io, ctx, 'refunded');
        await log(io, ctx, 'info', '💰 Payment automatically refunded due to migration failure');
        broadcast(io, migrationId, { type: 'refund', message: 'Payment automatically refunded due to migration failure' });
      } catch (refundErr) {
        logger.error(`Auto-refund failed for ${migrationId}: ${refundErr.message}`);
      }
    }

    // ── Fire-and-forget failure email (Task 17) ──────────────────────────────────────
    try {
      const { data: authData } = await supabaseAdmin.auth.admin.getUserById(migration.user_id);
      const userEmail = authData?.user?.email;
      const userName  = authData?.user?.user_metadata?.name || authData?.user?.user_metadata?.full_name || '';
      if (userEmail) {
        await sendMigrationFailed(
          userEmail,
          ctx.repoInfo?.name || migration.repourl,
          err.message,
          migrationId,
          userName,
        );
      }
    } catch (_) { /* ignore */ }

    throw err;
  }
}

module.exports = { runMigration };
