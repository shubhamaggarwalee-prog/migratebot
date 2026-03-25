/**
 * backend/services/email.js
 * Nodemailer-based transactional email service.
 * All public methods are async and resolve to { success: true } or throw.
 *
 * Task 17: Replaced thin sendMigrationCompleteEmail with two fully-featured
 *          functions (sendMigrationComplete + sendMigrationFailed) that match
 *          the names already called in migrationRunner.js.
 *          Both emails include:
 *            • Plain-English subject line
 *            • Live URL(s) prominently displayed
 *            • Direct link to the migration detail page
 *            • Plain-English next steps / recovery instructions
 */
const nodemailer = require('nodemailer');

const transport = nodemailer.createTransport({
  host  : process.env.SMTP_HOST   || 'smtp.postmarkapp.com',
  port  : parseInt(process.env.SMTP_PORT || '587', 10),
  auth  : {
    user: process.env.SMTP_USER   || '',
    pass: process.env.SMTP_PASS   || '',
  },
  secure: process.env.SMTP_SECURE === 'true',
});

const FROM         = process.env.EMAIL_FROM    || 'MigrateBot <hello@migratebot.io>';
const FRONTEND_URL = process.env.FRONTEND_URL  || 'https://migratebot.io';

// ─── shared base template ──────────────────────────────────────────────────────────

function baseHtml(title, bodyHtml) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
<style>
  *    { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: #F8F7F4; color: #1A1814; }
  .wrap  { max-width: 580px; margin: 40px auto; background: #fff;
           border-radius: 16px; border: 1px solid #E5E2DA; overflow: hidden; }
  .head  { background: #1A1814; padding: 24px 32px; }
  .logo  { font-size: 20px; font-weight: 700; color: #fff; font-family: Georgia, serif; }
  .logo span { color: #D97706; }
  .body  { padding: 32px; }
  h1     { font-size: 22px; font-family: Georgia, serif; margin-bottom: 10px; }
  p      { font-size: 14px; color: #5C574E; line-height: 1.7; margin-bottom: 14px; }
  .badge { display: inline-block; padding: 3px 12px; border-radius: 20px;
           font-size: 11px; font-weight: 700; margin-bottom: 16px; }
  .green  { background: #D1FAE5; color: #065F46; }
  .red    { background: #FEE2E2; color: #991B1B; }
  .amber  { background: #FEF3C7; color: #92400E; }
  .box   { background: #F8F7F4; border: 1px solid #E5E2DA; border-radius: 10px;
           padding: 14px 16px; margin: 14px 0; font-size: 13px; line-height: 1.7; }
  .url-row { display: flex; align-items: center; margin-bottom: 8px; }
  .url-label { font-size: 11px; color: #9B958A; width: 120px; flex-shrink: 0; }
  .url-link  { color: #D97706; font-weight: 700; word-break: break-all;
               text-decoration: none; font-size: 13px; }
  .cta   { display: block; text-align: center; padding: 14px;
           background: #D97706; color: #fff !important; border-radius: 10px;
           font-weight: 700; font-size: 15px; text-decoration: none; margin: 22px 0; }
  .cta-outline { display: block; text-align: center; padding: 12px;
                 background: #fff; color: #D97706 !important; border-radius: 10px;
                 font-weight: 700; font-size: 14px; text-decoration: none;
                 margin: 10px 0; border: 2px solid #D97706; }
  .steps { counter-reset: step; }
  .step  { display: flex; gap: 12px; margin-bottom: 12px; }
  .step-num { background: #FEF3C7; color: #92400E; font-weight: 700; font-size: 12px;
              border-radius: 50%; width: 24px; height: 24px; display: flex;
              align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
  .step-text { font-size: 13px; color: #5C574E; line-height: 1.6; }
  .divider { border: none; border-top: 1px solid #E5E2DA; margin: 20px 0; }
  .foot  { padding: 16px 32px; border-top: 1px solid #E5E2DA;
           font-size: 11px; color: #9B958A; text-align: center; line-height: 1.6; }
  .foot a { color: #D97706; text-decoration: none; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="head"><div class="logo">⚡ Migrate<span>Bot</span></div></div>
    <div class="body">${bodyHtml}</div>
    <div class="foot">
      MigrateBot · <a href="mailto:support@migratebot.io">support@migratebot.io</a><br />
      You're receiving this because you have a migration with us.
    </div>
  </div>
</body>
</html>`;
}

// ─── internal send helper ──────────────────────────────────────────────────────────

async function send({ to, subject, html }) {
  await transport.sendMail({ from: FROM, to, subject, html });
  return { success: true };
}

// ─── public API ─────────────────────────────────────────────────────────────────

/**
 * sendMigrationComplete
 * Called by migrationRunner on successful deployment.
 *
 * @param {string} to            - Recipient email
 * @param {string} repoName      - Human-readable project name
 * @param {object} deployedUrls  - { frontend, backend, database } — any can be null
 * @param {string} migrationId   - UUID used to build the detail-page link
 * @param {string} [name]        - User's display name (falls back to email prefix)
 */
async function sendMigrationComplete(to, repoName, deployedUrls = {}, migrationId = '', name = '') {
  const displayName    = name || to.split('@')[0];
  const detailUrl      = migrationId
    ? `${FRONTEND_URL}/migrations/${migrationId}`
    : `${FRONTEND_URL}/dashboard`;
  const primaryUrl     = deployedUrls.frontend || deployedUrls.backend || '';

  // Build URL rows — only include URLs that exist
  const urlRowsHtml = [
    deployedUrls.frontend && `
      <div class="url-row">
        <span class="url-label">🌐 Your app</span>
        <a class="url-link" href="${deployedUrls.frontend}">${deployedUrls.frontend}</a>
      </div>`,
    deployedUrls.backend  && `
      <div class="url-row">
        <span class="url-label">⚙️ Backend</span>
        <a class="url-link" href="${deployedUrls.backend}">${deployedUrls.backend}</a>
      </div>`,
    deployedUrls.database && `
      <div class="url-row">
        <span class="url-label">🗄️ Database</span>
        <a class="url-link" href="${deployedUrls.database}">${deployedUrls.database}</a>
      </div>`,
  ].filter(Boolean).join('');

  const html = baseHtml(`Your app "${repoName}" is live!`, `
    <h1>Your app is live, ${displayName}! 🎉</h1>
    <span class="badge green">✓ Deployed successfully</span>

    <p>
      <strong>${repoName}</strong> has been deployed and is now accessible
      to anyone in the world. Here are your live links:
    </p>

    <div class="box">
      ${urlRowsHtml || '<span style="color:#9B958A">No URLs recorded — check your dashboard.</span>'}
    </div>

    ${primaryUrl
      ? `<a class="cta" href="${primaryUrl}">Visit your live app →</a>`
      : ''}
    <a class="cta-outline" href="${detailUrl}">View migration details →</a>

    <hr class="divider" />

    <p style="font-size:13px;font-weight:700;color:#1A1814;margin-bottom:10px">📌 What to do next</p>
    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text"><strong>Visit your app</strong> and click through every page to make sure everything looks right.</div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text"><strong>Share it</strong> — copy the link above and send it to anyone you’d like to try it.</div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text"><strong>Add a custom domain</strong> (optional) — in your Vercel dashboard under “Domains” you can attach your own domain name like <em>myapp.com</em>.</div>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <div class="step-text"><strong>Make changes?</strong> Use the “Push a Change” button on your dashboard to redeploy without touching any code.</div>
      </div>
    </div>

    <p style="font-size:12px;color:#9B958A;margin-top:20px">Questions? Just reply to this email — we read everything.</p>
  `);

  return send({
    to,
    subject: `✅ Your app is live — ${repoName}`,
    html,
  });
}

/**
 * sendMigrationFailed
 * Called by migrationRunner when an error is thrown.
 *
 * @param {string} to           - Recipient email
 * @param {string} repoName     - Human-readable project name
 * @param {string} errorMessage - Technical error from the runner
 * @param {string} migrationId  - UUID used to build the detail-page link
 * @param {string} [name]       - User's display name
 */
async function sendMigrationFailed(to, repoName, errorMessage = '', migrationId = '', name = '') {
  const displayName = name || to.split('@')[0];
  const detailUrl   = migrationId
    ? `${FRONTEND_URL}/migrations/${migrationId}`
    : `${FRONTEND_URL}/dashboard`;

  // Translate common technical errors into plain English
  function humaniseError(raw) {
    const msg = (raw || '').toLowerCase();
    if (msg.includes('missing credentials'))   return 'One or more API keys were missing or incorrect. Please check your credentials in Settings and try again.';
    if (msg.includes('rate limit'))            return 'A platform rate limit was hit during deployment. Waiting a few minutes and retrying usually fixes this.';
    if (msg.includes('timeout'))               return 'The deployment took longer than expected and timed out. This is usually temporary — try again in a few minutes.';
    if (msg.includes('already exists'))        return 'A project with this name already exists on one of the platforms. You can rename your repo and retry.';
    if (msg.includes('permission') || msg.includes('forbidden') || msg.includes('401') || msg.includes('403'))
      return 'A platform returned a permission error. Your API key may have expired or lack the required scopes — please reconnect it in Settings.';
    if (msg.includes('network') || msg.includes('enotfound') || msg.includes('econnrefused'))
      return 'A network error occurred while talking to a deployment platform. This is usually temporary — please try again.';
    return 'An unexpected error occurred during deployment. Our team has been notified automatically.';
  }

  const plainEnglishError = humaniseError(errorMessage);

  const html = baseHtml(`Deployment issue — ${repoName}`, `
    <h1>Something went wrong, ${displayName} ⚠️</h1>
    <span class="badge red">⚠️ Deployment did not complete</span>

    <p>
      Your migration of <strong>${repoName}</strong> ran into a problem
      and couldn’t finish. <strong>You have not been charged.</strong>
      If a payment was taken, a full refund has been issued automatically.
    </p>

    <div class="box">
      <div style="font-size:12px;font-weight:700;color:#991B1B;margin-bottom:6px">🔍 What happened</div>
      <div style="font-size:13px;color:#5C574E;line-height:1.6">${plainEnglishError}</div>
      ${errorMessage ? `
        <details style="margin-top:10px">
          <summary style="font-size:11px;color:#9B958A;cursor:pointer">Show technical details</summary>
          <pre style="margin-top:6px;font-size:11px;color:#9B958A;white-space:pre-wrap;word-break:break-all">${
            errorMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 500)
          }</pre>
        </details>` : ''}
    </div>

    <a class="cta" href="${detailUrl}">View migration details →</a>

    <hr class="divider" />

    <p style="font-size:13px;font-weight:700;color:#1A1814;margin-bottom:10px">🛠️ How to fix this</p>
    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text"><strong>Read the error above</strong> — it describes exactly what went wrong in plain English.</div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text"><strong>Check your credentials</strong> — the most common cause is an expired or incorrectly scoped API key. Go to <a href="${FRONTEND_URL}/settings" style="color:#D97706">Settings → Credentials</a> to review them.</div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text"><strong>Retry the migration</strong> from your <a href="${FRONTEND_URL}/dashboard" style="color:#D97706">dashboard</a>. Most failures are one-time glitches that resolve on the second attempt.</div>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <div class="step-text"><strong>Still stuck?</strong> Reply to this email and we’ll fix it for you — usually within a few hours.</div>
      </div>
    </div>

    <p style="font-size:12px;color:#9B958A;margin-top:20px">
      Our engineering team has been automatically alerted. You don’t need to do anything right now if you’d prefer to wait.
    </p>
  `);

  return send({
    to,
    subject: `⚠️ Deployment issue with ${repoName} — here’s what to do`,
    html,
  });
}

/**
 * sendWelcomeEmail
 */
async function sendWelcomeEmail({ to, name }) {
  const html = baseHtml('Welcome to MigrateBot', `
    <h1>Welcome, ${name}! 🎉</h1>
    <p>You're all set to deploy your first app. It takes about 3 minutes from start to live.</p>
    <a class="cta" href="${FRONTEND_URL}/migrate">Deploy my first app →</a>
    <p style="font-size:12px;color:#9B958A">Questions? Reply to this email — we read everything.</p>
  `);
  return send({ to, subject: 'Welcome to MigrateBot ⚡', html });
}

/**
 * sendUpdateCompleteEmail (Task 14)
 */
async function sendUpdateCompleteEmail({ to, name, appUrl, filesChanged, commitMsg, outcome }) {
  const success  = outcome === 'ready';
  const warning  = outcome === 'timeout';
  const badgeCls = success ? 'green' : warning ? 'amber' : 'red';
  const badgeTxt = success ? '✓ Live' : warning ? '⏳ Still deploying' : '✗ Deploy error';
  const title    = success ? `Your update is live, ${name}! 🚀` : `Update deployed — ${outcome}`;
  const html = baseHtml(title, `
    <h1>${title}</h1>
    <span class="badge ${badgeCls}">${badgeTxt}</span>
    <div class="box" style="margin-top:16px">
      <div style="margin-bottom:8px"><strong>Files changed:</strong> ${filesChanged}</div>
      <div style="word-break:break-all"><strong>Commit message:</strong> ${commitMsg}</div>
    </div>
    ${
      success
        ? `<p>Your changes are live at:</p>
           <div class="box"><a href="${appUrl}" style="color:#D97706;font-weight:700;word-break:break-all">${appUrl}</a></div>
           <a class="cta" href="${appUrl}">View your updated app →</a>`
        : warning
        ? `<p>Vercel is still processing your deployment. Check your Vercel dashboard for the final status.</p>
           <a class="cta" href="${appUrl}">Open Vercel dashboard →</a>`
        : `<p>Your files were committed to GitHub but Vercel reported a build error. Check your Vercel dashboard — your previous version is still live.</p>
           <a class="cta" href="${appUrl}">Open Vercel dashboard →</a>`
    }
    <p style="font-size:12px;color:#9B958A">You're receiving this because you just pushed an update through MigrateBot.</p>
  `);
  return send({
    to,
    subject: success
      ? `🚀 Your update is live — ${filesChanged} file${filesChanged > 1 ? 's' : ''} changed`
      : `⚠️ MigrateBot update: ${outcome}`,
    html,
  });
}

/**
 * sendPasswordResetEmail
 */
async function sendPasswordResetEmail({ to, resetUrl }) {
  const html = baseHtml('Reset your password', `
    <h1>Reset your password</h1>
    <p>Someone (hopefully you) requested a password reset for your MigrateBot account.</p>
    <a class="cta" href="${resetUrl}">Reset my password →</a>
    <p>This link expires in 1 hour. If you didn’t request this, ignore this email.</p>
  `);
  return send({ to, subject: 'Reset your MigrateBot password', html });
}

/**
 * sendVerificationEmail
 */
async function sendVerificationEmail({ to, verifyUrl }) {
  const html = baseHtml('Verify your email', `
    <h1>Verify your email address</h1>
    <p>Click below to verify your email and activate your MigrateBot account.</p>
    <a class="cta" href="${verifyUrl}">Verify my email →</a>
    <p>This link expires in 24 hours.</p>
  `);
  return send({ to, subject: 'Verify your MigrateBot email', html });
}

// Legacy alias kept for backward compatibility
const sendMigrationCompleteEmail = sendMigrationComplete;

module.exports = {
  sendWelcomeEmail,
  sendMigrationComplete,
  sendMigrationFailed,
  sendMigrationCompleteEmail,     // legacy alias
  sendUpdateCompleteEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
};
