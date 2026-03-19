/**
 * backend/services/email.js
 *
 * SendGrid transactional email service.
 * Six branded templates:
 *   1. Welcome / email verification
 *   2. Migration started
 *   3. Migration success
 *   4. Migration failed + automatic refund notice
 *   5. Payment receipt
 *   6. Password reset
 *
 * All emails share a consistent MigrateBot cream-and-amber brand.
 */

const sgMail = require('@sendgrid/mail');
const logger = require('../utils/logger');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const FROM = {
  email: process.env.EMAIL_FROM || 'noreply@migratebot.io',
  name:  'MigrateBot',
};

// ─── BRAND CONSTANTS ──────────────────────────────────────────────────────────

const C = {
  bg:          '#F8F7F4',
  surface:     '#FFFFFF',
  border:      '#E5E2DA',
  ink:         '#1A1814',
  inkMid:      '#5C574E',
  inkLight:    '#9B958A',
  amber:       '#D97706',
  amberDark:   '#B45309',
  amberBg:     '#FEF3C7',
  amberBorder: '#FDE68A',
  green:       '#059669',
  greenBg:     '#D1FAE5',
  greenBorder: '#6EE7B7',
  red:         '#DC2626',
  redBg:       '#FEE2E2',
  redBorder:   '#FCA5A5',
};

// ─── SHARED LAYOUT ────────────────────────────────────────────────────────────

function layout(bodyContent, previewText = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>MigrateBot</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    body { margin:0; padding:0; background:${C.bg}; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; color:${C.ink}; -webkit-text-size-adjust:100%; }
    table { border-collapse:collapse; }
    a { color:${C.amber}; text-decoration:none; }
    a:hover { text-decoration:underline; }
    .btn { display:inline-block; padding:13px 32px; border-radius:8px; font-size:15px; font-weight:600; text-decoration:none !important; }
    .btn-amber { background:${C.amber}; color:#ffffff !important; }
    .btn-outline { background:transparent; color:${C.ink} !important; border:1.5px solid ${C.border}; }
    .badge { display:inline-block; padding:3px 10px; border-radius:100px; font-size:12px; font-weight:600; }
    .badge-green { background:${C.greenBg}; color:${C.green}; border:1px solid ${C.greenBorder}; }
    .badge-amber { background:${C.amberBg}; color:${C.amber}; border:1px solid ${C.amberBorder}; }
    .badge-red   { background:${C.redBg};   color:${C.red};   border:1px solid ${C.redBorder}; }
    @media only screen and (max-width:600px) {
      .wrapper { padding:0 16px !important; }
      .card    { padding:24px 20px !important; }
    }
  </style>
</head>
<body>
  <!-- Preview text -->
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;">${previewText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ''}

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${C.bg};">
    <tr><td align="center" class="wrapper" style="padding:40px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;">

        <!-- HEADER -->
        <tr><td style="padding-bottom:28px;">
          <table cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,${C.amber},${C.amberDark});text-align:center;vertical-align:middle;">
                <span style="font-size:18px;line-height:32px;">&#x1F680;</span>
              </td>
              <td style="padding-left:10px;">
                <span style="font-size:18px;font-weight:700;letter-spacing:-0.025em;color:${C.ink};">Migrate</span><span style="color:${C.amber};font-size:18px;font-weight:700;">Bot</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- BODY CARD -->
        <tr><td class="card" style="background:${C.surface};border:1px solid ${C.border};border-radius:12px;padding:36px 40px;">
          ${bodyContent}
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="padding-top:24px;text-align:center;font-size:12px;color:${C.inkLight};line-height:1.7;">
          MigrateBot &mdash; Deploy with confidence.<br />
          <a href="https://migratebot.io" style="color:${C.inkLight};">migratebot.io</a>
          &nbsp;&middot;&nbsp;
          <a href="https://migratebot.io/unsubscribe" style="color:${C.inkLight};">Unsubscribe</a>
          &nbsp;&middot;&nbsp;
          <a href="https://migratebot.io/privacy" style="color:${C.inkLight};">Privacy</a>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────

function divider() {
  return `<tr><td style="padding:20px 0;"><div style="height:1px;background:${C.border};"></div></td></tr>`;
}

function metaRow(label, value) {
  return `
    <tr>
      <td style="font-size:12px;color:${C.inkLight};padding:6px 0 2px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;">${label}</td>
    </tr>
    <tr>
      <td style="font-size:14px;color:${C.ink};padding-bottom:14px;font-family:monospace;">${value}</td>
    </tr>`;
}

function ctaButton(text, url, style = 'btn-amber') {
  return `
    <tr><td style="padding-top:28px;">
      <a href="${url}" class="btn ${style}" style="${style === 'btn-amber' ? `background:${C.amber};color:#fff;` : `color:${C.ink};border:1.5px solid ${C.border};`}padding:13px 32px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;text-decoration:none;">${text}</a>
    </td></tr>`;
}

// ─── SEND HELPER ──────────────────────────────────────────────────────────────

async function send({ to, subject, html, text }) {
  const msg = {
    to,
    from: FROM,
    subject,
    html,
    text: text || subject, // plain-text fallback
    trackingSettings: {
      clickTracking:      { enable: false },
      openTracking:       { enable: true  },
      subscriptionTracking: { enable: false },
    },
  };
  try {
    await sgMail.send(msg);
    logger.info(`Email sent to ${to}: "${subject}"`);
  } catch (err) {
    const detail = err.response?.body?.errors?.[0]?.message || err.message;
    logger.error(`Failed to send email to ${to}: ${detail}`);
    // Don't let email failures crash the migration pipeline
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. WELCOME / EMAIL VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @param {string} toEmail
 * @param {string} name
 * @param {string} verifyToken  - Raw token appended to the verify URL
 */
async function sendWelcome(toEmail, name, verifyToken) {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verifyToken}`;
  const firstName = name?.split(' ')[0] || 'there';

  const body = `
    <tr><td>
      <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;letter-spacing:-0.025em;color:${C.ink};">Welcome to MigrateBot &#x1F44B;</h1>
      <p style="margin:0 0 24px;font-size:15px;color:${C.inkMid};line-height:1.7;">Hey ${firstName}, you're in. One click and your vibe-coded app becomes production-ready.</p>
    </td></tr>
    <tr><td style="background:${C.amberBg};border:1px solid ${C.amberBorder};border-radius:10px;padding:20px 24px;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:${C.amberDark};letter-spacing:.04em;text-transform:uppercase;">First, verify your email</p>
      <p style="margin:0;font-size:14px;color:${C.inkMid};line-height:1.6;">Click the button below to confirm your address and unlock your dashboard.</p>
    </td></tr>
    ${ctaButton('Verify email address', verifyUrl)}
    <tr><td style="padding-top:20px;">
      <p style="margin:0;font-size:13px;color:${C.inkLight};line-height:1.7;">Or copy this link into your browser:<br /><span style="font-family:monospace;font-size:12px;color:${C.inkMid};word-break:break-all;">${verifyUrl}</span></p>
    </td></tr>
    ${divider()}
    <tr><td>
      <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:${C.inkLight};letter-spacing:.04em;text-transform:uppercase;">What you can do now</p>
      <table cellpadding="0" cellspacing="0" width="100%">
        ${['Paste a GitHub repo URL and start a migration', 'Add your Vercel, Railway &amp; Supabase tokens', 'Deploy your first app in under 3 minutes'].map(item => `
        <tr><td style="padding:6px 0;font-size:14px;color:${C.inkMid};">
          <span style="color:${C.amber};font-weight:700;margin-right:8px;">&#x2713;</span>${item}
        </td></tr>`).join('')}
      </table>
    </td></tr>`;

  await send({
    to: toEmail,
    subject: 'Welcome to MigrateBot — verify your email',
    html: layout(body, 'Your MigrateBot account is ready. Verify your email to get started.'),
    text: `Welcome to MigrateBot, ${firstName}!\n\nVerify your email: ${verifyUrl}`,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. MIGRATION STARTED
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @param {string} toEmail
 * @param {string} name
 * @param {{ id, repoUrl, platforms: string[], plan: string }} migration
 */
async function sendMigrationStarted(toEmail, name, migration) {
  const dashUrl  = `${process.env.FRONTEND_URL}/migrations/${migration.id}`;
  const firstName = name?.split(' ')[0] || 'there';
  const platforms = (migration.platforms || []).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ');

  const body = `
    <tr><td>
      <span class="badge badge-amber" style="background:${C.amberBg};color:${C.amber};border:1px solid ${C.amberBorder};padding:3px 10px;border-radius:100px;font-size:12px;font-weight:600;">&#x23F3; In progress</span>
      <h1 style="margin:16px 0 8px;font-size:24px;font-weight:700;letter-spacing:-0.025em;color:${C.ink};">Your migration is running</h1>
      <p style="margin:0 0 24px;font-size:15px;color:${C.inkMid};line-height:1.7;">Hey ${firstName}, MigrateBot is analysing your codebase and spinning up your infrastructure. This usually takes 2&ndash;4 minutes.</p>
    </td></tr>
    <tr><td style="background:${C.bg};border:1px solid ${C.border};border-radius:10px;padding:20px 24px;">
      <table cellpadding="0" cellspacing="0" width="100%">
        ${metaRow('Repository', migration.repoUrl || '—')}
        ${metaRow('Platforms',  platforms || '—')}
        ${metaRow('Plan',       migration.plan ? migration.plan.charAt(0).toUpperCase() + migration.plan.slice(1) : 'Starter')}
        ${metaRow('Migration ID', migration.id)}
      </table>
    </td></tr>
    ${ctaButton('Watch live progress', dashUrl)}
    <tr><td style="padding-top:20px;">
      <p style="margin:0;font-size:13px;color:${C.inkLight};line-height:1.7;">We'll email you the moment it's live. You can close this tab &mdash; MigrateBot keeps running in the background.</p>
    </td></tr>`;

  await send({
    to: toEmail,
    subject: `Migration started — ${migration.repoUrl}`,
    html: layout(body, 'Your MigrateBot migration is now running. We\'ll email you when it\'s live.'),
    text: `Your migration is running.\n\nRepo: ${migration.repoUrl}\nTrack progress: ${dashUrl}`,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. MIGRATION SUCCESS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @param {string} toEmail
 * @param {string} name
 * @param {{
 *   id: string,
 *   repoUrl: string,
 *   durationSeconds: number,
 *   deployedUrls: { frontend?, backend?, database?, pr? }
 * }} migration
 */
async function sendMigrationSuccess(toEmail, name, migration) {
  const dashUrl   = `${process.env.FRONTEND_URL}/migrations/${migration.id}`;
  const firstName = name?.split(' ')[0] || 'there';
  const duration  = migration.durationSeconds
    ? `${Math.floor(migration.durationSeconds / 60)}m ${migration.durationSeconds % 60}s`
    : null;

  const urls = migration.deployedUrls || {};
  const urlRows = [
    urls.frontend && { label: 'Frontend',    url: urls.frontend },
    urls.backend  && { label: 'Backend API', url: urls.backend  },
    urls.database && { label: 'Database',    url: urls.database },
    urls.pr       && { label: 'GitHub PR',   url: urls.pr       },
  ].filter(Boolean);

  const body = `
    <tr><td style="text-align:center;padding-bottom:8px;">
      <div style="width:56px;height:56px;border-radius:50%;background:${C.greenBg};border:2px solid ${C.green};display:inline-flex;align-items:center;justify-content:center;font-size:26px;margin:0 auto 16px;">&#x2713;</div>
      <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;letter-spacing:-0.025em;color:${C.ink};">You're live! &#x1F389;</h1>
      <p style="margin:0 0 4px;font-size:15px;color:${C.inkMid};">${duration ? `Deployed in <strong>${duration}</strong>.` : 'Migration completed successfully.'}</p>
      <p style="margin:0 0 28px;font-size:14px;color:${C.inkLight};">Hey ${firstName}, your app is live on production.</p>
    </td></tr>
    ${urlRows.length ? `
    <tr><td style="background:${C.greenBg};border:1px solid ${C.greenBorder};border-radius:10px;padding:20px 24px;margin-bottom:20px;">
      <p style="margin:0 0 14px;font-size:12px;font-weight:600;color:${C.green};letter-spacing:.04em;text-transform:uppercase;">Your deployed URLs</p>
      <table cellpadding="0" cellspacing="0" width="100%">
        ${urlRows.map(({ label, url }) => `
        <tr>
          <td style="font-size:13px;color:${C.inkLight};width:100px;padding:5px 0;">${label}</td>
          <td style="font-size:13px;"><a href="${url}" style="color:${C.amber};font-family:monospace;word-break:break-all;">${url}</a></td>
        </tr>`).join('')}
      </table>
    </td></tr>` : ''}
    ${ctaButton('Open dashboard', dashUrl)}
    ${divider()}
    <tr><td>
      <p style="margin:0;font-size:13px;color:${C.inkLight};line-height:1.7;">Migration ID: <span style="font-family:monospace;">${migration.id}</span></p>
    </td></tr>`;

  await send({
    to: toEmail,
    subject: `✅ Migration complete — you're live!`,
    html: layout(body, 'Your MigrateBot migration succeeded. Your app is live on production.'),
    text: `Your migration is complete!\n\n${urlRows.map(r => `${r.label}: ${r.url}`).join('\n')}\n\nDashboard: ${dashUrl}`,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. MIGRATION FAILED + AUTOMATIC REFUND NOTICE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @param {string} toEmail
 * @param {string} name
 * @param {{
 *   id: string,
 *   repoUrl: string,
 *   errorMessage: string,
 *   refunded: boolean,
 *   amountRefunded?: number   - in cents
 * }} migration
 */
async function sendMigrationFailed(toEmail, name, migration) {
  const dashUrl   = `${process.env.FRONTEND_URL}/migrations/${migration.id}`;
  const supportUrl = `${process.env.FRONTEND_URL}/support?ref=${migration.id}`;
  const firstName  = name?.split(' ')[0] || 'there';
  const refundAmt  = migration.amountRefunded
    ? `$${(migration.amountRefunded / 100).toFixed(2)}`
    : 'the full amount';

  const body = `
    <tr><td style="text-align:center;padding-bottom:8px;">
      <div style="width:56px;height:56px;border-radius:50%;background:${C.redBg};border:2px solid ${C.red};display:inline-block;text-align:center;line-height:56px;font-size:26px;margin:0 auto 16px;">&#x26A0;</div>
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;letter-spacing:-0.025em;color:${C.ink};">Migration failed</h1>
      <p style="margin:0 0 28px;font-size:15px;color:${C.inkMid};line-height:1.7;">Hey ${firstName}, something went wrong during your migration. Don't worry &mdash; ${migration.refunded ? 'your payment has been automatically refunded.' : 'our team is looking into it.'}</p>
    </td></tr>
    <tr><td style="background:${C.redBg};border:1px solid ${C.redBorder};border-radius:10px;padding:16px 20px;margin-bottom:16px;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:${C.red};letter-spacing:.04em;text-transform:uppercase;">Error details</p>
      <p style="margin:0;font-size:13px;color:${C.ink};font-family:monospace;line-height:1.6;word-break:break-word;">${migration.errorMessage || 'An unexpected error occurred.'}</p>
    </td></tr>
    ${migration.refunded ? `
    <tr><td style="padding-top:16px;">
      <table cellpadding="0" cellspacing="0" width="100%" style="background:${C.greenBg};border:1px solid ${C.greenBorder};border-radius:10px;padding:16px 20px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${C.green};letter-spacing:.04em;text-transform:uppercase;">&#x2713; Automatic refund issued</p>
          <p style="margin:0;font-size:14px;color:${C.inkMid};line-height:1.6;">We've refunded <strong>${refundAmt}</strong> to your original payment method. It typically appears within 3&ndash;5 business days.</p>
        </td></tr>
      </table>
    </td></tr>` : ''}
    <tr><td style="padding-top:24px;">
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-right:12px;">
            <a href="${dashUrl}" class="btn btn-outline" style="color:${C.ink};border:1.5px solid ${C.border};padding:11px 24px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block;text-decoration:none;">View migration log</a>
          </td>
          <td>
            <a href="${supportUrl}" class="btn btn-amber" style="background:${C.amber};color:#fff;padding:11px 24px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block;text-decoration:none;">Contact support</a>
          </td>
        </tr>
      </table>
    </td></tr>
    ${divider()}
    <tr><td>
      <p style="margin:0;font-size:13px;color:${C.inkLight};line-height:1.7;">Migration ID: <span style="font-family:monospace;">${migration.id}</span><br />Repository: <span style="font-family:monospace;">${migration.repoUrl || '—'}</span></p>
    </td></tr>`;

  await send({
    to: toEmail,
    subject: `Migration failed — ${migration.refunded ? 'full refund issued' : 'we\'re looking into it'}`,
    html: layout(body, migration.refunded
      ? 'Your migration failed but your payment has been automatically refunded.'
      : 'Your MigrateBot migration encountered an error.'),
    text: `Migration failed.\n\nError: ${migration.errorMessage}\n${migration.refunded ? `\nRefund of ${refundAmt} has been issued.` : ''}\n\nDashboard: ${dashUrl}\nSupport: ${supportUrl}`,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. PAYMENT RECEIPT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @param {string} toEmail
 * @param {string} name
 * @param {{
 *   migrationId: string,
 *   repoUrl: string,
 *   plan: string,
 *   amountCharged: number   - in cents
 *   currency?: string       - default 'usd'
 *   paymentIntentId: string
 *   last4?: string          - last 4 digits of card
 *   brand?: string          - e.g. 'Visa'
 *   date?: string           - ISO date string, defaults to now
 * }} receipt
 */
async function sendPaymentReceipt(toEmail, name, receipt) {
  const dashUrl   = `${process.env.FRONTEND_URL}/migrations/${receipt.migrationId}`;
  const firstName = name?.split(' ')[0] || 'there';
  const amount    = `$${(receipt.amountCharged / 100).toFixed(2)} ${(receipt.currency || 'USD').toUpperCase()}`;
  const planLabel = receipt.plan
    ? receipt.plan.charAt(0).toUpperCase() + receipt.plan.slice(1) + ' Migration'
    : 'Migration';
  const dateStr   = receipt.date
    ? new Date(receipt.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const body = `
    <tr><td>
      <h1 style="margin:0 0 4px;font-size:24px;font-weight:700;letter-spacing:-0.025em;color:${C.ink};">Payment receipt</h1>
      <p style="margin:0 0 28px;font-size:15px;color:${C.inkMid};">Hey ${firstName}, thanks for your payment. Here's your receipt.</p>
    </td></tr>
    <tr><td style="background:${C.bg};border:1px solid ${C.border};border-radius:10px;padding:24px;">
      <table cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="font-size:14px;color:${C.inkMid};padding-bottom:16px;">${planLabel}</td>
          <td style="font-size:14px;font-weight:700;color:${C.ink};text-align:right;padding-bottom:16px;">${amount}</td>
        </tr>
        <tr><td colspan="2" style="height:1px;background:${C.border};padding:0;"></td></tr>
        <tr>
          <td style="font-size:15px;font-weight:700;color:${C.ink};padding-top:16px;">Total</td>
          <td style="font-size:18px;font-weight:700;color:${C.amber};text-align:right;padding-top:16px;">${amount}</td>
        </tr>
      </table>
    </td></tr>
    <tr><td style="padding-top:20px;">
      <table cellpadding="0" cellspacing="0" width="100%">
        ${metaRow('Date',         dateStr)}
        ${metaRow('Repository',   receipt.repoUrl || '—')}
        ${receipt.last4 ? metaRow('Payment method', `${receipt.brand || 'Card'} ending ${receipt.last4}`) : ''}
        ${metaRow('Transaction ID', receipt.paymentIntentId)}
      </table>
    </td></tr>
    ${ctaButton('View migration', dashUrl)}
    ${divider()}
    <tr><td>
      <p style="margin:0;font-size:13px;color:${C.inkLight};line-height:1.7;">If you have questions about this charge, <a href="mailto:billing@migratebot.io" style="color:${C.amber};">contact billing</a>. Full refund if migration fails.</p>
    </td></tr>`;

  await send({
    to: toEmail,
    subject: `Receipt for ${amount} — MigrateBot`,
    html: layout(body, `Your MigrateBot payment receipt for ${amount}.`),
    text: `Payment receipt\n\nAmount: ${amount}\nDate: ${dateStr}\nTransaction: ${receipt.paymentIntentId}\n\nDashboard: ${dashUrl}`,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. PASSWORD RESET
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @param {string} toEmail
 * @param {string} name
 * @param {string} resetToken  - Raw token appended to the reset URL
 */
async function sendPasswordReset(toEmail, name, resetToken) {
  const resetUrl  = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  const firstName = name?.split(' ')[0] || 'there';
  const expiryMin = 30;

  const body = `
    <tr><td>
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;letter-spacing:-0.025em;color:${C.ink};">Reset your password</h1>
      <p style="margin:0 0 24px;font-size:15px;color:${C.inkMid};line-height:1.7;">Hey ${firstName}, we received a request to reset the password for your MigrateBot account. Click the button below to choose a new one.</p>
    </td></tr>
    <tr><td style="background:${C.amberBg};border:1px solid ${C.amberBorder};border-radius:10px;padding:16px 20px;">
      <p style="margin:0;font-size:14px;color:${C.inkMid};line-height:1.6;">&#x23F0; This link expires in <strong>${expiryMin} minutes</strong>. If you didn't request a reset, you can safely ignore this email &mdash; your password hasn't changed.</p>
    </td></tr>
    ${ctaButton('Reset password', resetUrl)}
    <tr><td style="padding-top:16px;">
      <p style="margin:0;font-size:13px;color:${C.inkLight};line-height:1.7;">Or copy this link:<br /><span style="font-family:monospace;font-size:12px;color:${C.inkMid};word-break:break-all;">${resetUrl}</span></p>
    </td></tr>
    ${divider()}
    <tr><td>
      <p style="margin:0;font-size:13px;color:${C.inkLight};line-height:1.7;">If you didn't request this, please <a href="mailto:security@migratebot.io" style="color:${C.amber};">contact security</a> immediately.</p>
    </td></tr>`;

  await send({
    to: toEmail,
    subject: 'Reset your MigrateBot password',
    html: layout(body, 'You requested a password reset for your MigrateBot account.'),
    text: `Reset your MigrateBot password\n\nReset link (expires in ${expiryMin} minutes):\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
  });
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
  sendWelcome,
  sendMigrationStarted,
  sendMigrationSuccess,
  sendMigrationFailed,
  sendPaymentReceipt,
  sendPasswordReset,
};
