/**
 * backend/services/email.js
 * Nodemailer-based transactional email service.
 * All methods are async and resolve to { success: true } or throw.
 *
 * Task 14 addition: sendUpdateCompleteEmail
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

const FROM = process.env.EMAIL_FROM || 'MigrateBot <hello@migratebot.io>';

// ─── shared base template ───────────────────────────────────────────────────
function baseHtml(title, bodyHtml) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
<style>
  *   { box-sizing: border-box; margin: 0; padding: 0; }
  body{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: #F8F7F4; color: #1A1814; }
  .wrap  { max-width: 560px; margin: 40px auto; background: #fff;
           border-radius: 16px; border: 1px solid #E5E2DA;
           overflow: hidden; }
  .head  { background: #1A1814; padding: 24px 32px;
           display: flex; align-items: center; gap: 10px; }
  .logo  { font-size: 20px; font-weight: 700; color: #fff;
           font-family: Georgia, serif; }
  .logo span { color: #D97706; }
  .body  { padding: 32px; }
  h1     { font-size: 22px; font-family: Georgia, serif; margin-bottom: 8px; }
  p      { font-size: 14px; color: #5C574E; line-height: 1.7; margin-bottom: 14px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px;
           font-size: 11px; font-weight: 700; }
  .green { background: #D1FAE5; color: #065F46; }
  .red   { background: #FEE2E2; color: #991B1B; }
  .amber { background: #FEF3C7; color: #92400E; }
  .box   { background: #F8F7F4; border: 1px solid #E5E2DA; border-radius: 10px;
           padding: 14px 16px; margin: 16px 0; font-size: 13px; }
  .cta   { display: block; text-align: center; padding: 13px;
           background: #D97706; color: #fff !important; border-radius: 10px;
           font-weight: 700; font-size: 15px; text-decoration: none;
           margin: 20px 0; }
  .foot  { padding: 16px 32px; border-top: 1px solid #E5E2DA;
           font-size: 11px; color: #9B958A; text-align: center; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="head"><div class="logo">⚡ Migrate<span>Bot</span></div></div>
    <div class="body">${bodyHtml}</div>
    <div class="foot">MigrateBot · support@migratebot.io · You're receiving this because you have a live migration with us.</div>
  </div>
</body>
</html>`;
}

// ─── helpers ────────────────────────────────────────────────────────────────
async function send({ to, subject, html }) {
  await transport.sendMail({ from: FROM, to, subject, html });
  return { success: true };
}

// ─── public API ─────────────────────────────────────────────────────────────

/**
 * Welcome email sent after account creation.
 */
async function sendWelcomeEmail({ to, name }) {
  const html = baseHtml('Welcome to MigrateBot', `
    <h1>Welcome, ${name}! 🎉</h1>
    <p>You're all set to deploy your first app. It takes about 3 minutes from start to live.</p>
    <a class="cta" href="https://migratebot.io/migrate">Deploy my first app →</a>
    <p style="font-size:12px;color:#9B958A">Questions? Reply to this email — we read everything.</p>
  `);
  return send({ to, subject: 'Welcome to MigrateBot ⚡', html });
}

/**
 * Sent when a migration completes (success or fail).
 */
async function sendMigrationCompleteEmail({ to, name, appUrl, status, plan }) {
  const success = status === 'complete';
  const badgeCls = success ? 'green' : 'red';
  const badgeTxt = success ? '✓ Deployed successfully' : '✗ Migration failed';
  const html = baseHtml(success ? 'Your app is live! 🎉' : 'Migration failed', `
    <h1>${success ? `Your app is live, ${name}! 🎉` : `Something went wrong, ${name}`}</h1>
    <span class="badge ${badgeCls}">${badgeTxt}</span>
    ${
      success
        ? `<p style="margin-top:12px">Your <strong>${plan}</strong> migration completed. Your app is now live at:</p>
           <div class="box"><a href="${appUrl}" style="color:#D97706;font-weight:700;word-break:break-all">${appUrl}</a></div>
           <a class="cta" href="${appUrl}">Visit your live app →</a>`
        : `<p style="margin-top:12px">Your migration encountered an error. You have not been charged.</p>
           <p>Our team has been notified and will follow up within 2 hours.</p>
           <a class="cta" href="https://migratebot.io/dashboard">Go to dashboard →</a>`
    }
    <p style="font-size:12px;color:#9B958A">Need help? Reply to this email.</p>
  `);
  return send({ to, subject: success ? '🎉 Your app is live!' : '⚠️ Migration issue — we're on it', html });
}

/**
 * Sent when a /update redeploy finishes (Task 14).
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
        : `<p>Your files were committed to GitHub but Vercel reported a build error. Check your Vercel dashboard for details — your previous version is still live.</p>
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
 * Password reset email.
 */
async function sendPasswordResetEmail({ to, resetUrl }) {
  const html = baseHtml('Reset your password', `
    <h1>Reset your password</h1>
    <p>Someone (hopefully you) requested a password reset for your MigrateBot account.</p>
    <a class="cta" href="${resetUrl}">Reset my password →</a>
    <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
  `);
  return send({ to, subject: 'Reset your MigrateBot password', html });
}

/**
 * Email verification.
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

module.exports = {
  sendWelcomeEmail,
  sendMigrationCompleteEmail,
  sendUpdateCompleteEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
};
