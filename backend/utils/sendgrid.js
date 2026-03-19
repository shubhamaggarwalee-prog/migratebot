/**
 * backend/utils/sendgrid.js — DELETED
 *
 * This file is intentionally empty. It has been replaced by backend/services/email.js
 * which is the canonical email service for this project.
 *
 * Any file that previously imported from utils/sendgrid.js should now import from services/email.js:
 *
 *   const { sendMigrationComplete, sendPasswordReset } = require('../services/email');
 *
 * This stub is kept temporarily to prevent require() errors during deployment.
 * Remove it after verifying no live imports remain.
 */
const email = require('../services/email');
module.exports = email;
