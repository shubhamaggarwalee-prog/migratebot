/**
 * backend/utils/sendgrid.js
 * Email sending via SendGrid
 */
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

async function sendEmail({ to, subject, html, text }) {
  if (!process.env.SENDGRID_API_KEY) {
    console.log(`[EMAIL SKIPPED] To: ${to} | Subject: ${subject}`);
    return;
  }
  try {
    await sgMail.send({ to, from: process.env.SENDGRID_FROM_EMAIL || 'noreply@migratebot.io', subject, html, text });
    console.log(`Email sent to ${to}`);
  } catch (err) {
    console.error('SendGrid error:', err.message);
  }
}

async function sendMigrationComplete(email, migrationName, frontendUrl) {
  await sendEmail({
    to: email,
    subject: 'Your migration is complete!',
    html: `<h2>Migration Complete 🎉</h2><p>Your project <strong>${migrationName}</strong> has been successfully migrated.</p><p><a href="${frontendUrl}/dashboard">View Dashboard</a></p>`,
    text: `Migration complete! View your dashboard at ${frontendUrl}/dashboard`,
  });
}

module.exports = { sendEmail, sendMigrationComplete };
