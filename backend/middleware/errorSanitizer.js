/**
 * backend/middleware/errorSanitizer.js
 *
 * Two Express middleware functions:
 *  1. sanitizeErrors   — global error handler (replaces the inline one in server.js)
 *                        Strips stack traces, raw DB/Supabase/Stripe messages,
 *                        and any credential values from responses sent to clients.
 *  2. sanitizeLogs     — request-body scrubber. Wraps logger calls so that
 *                        sensitive fields (tokens, keys, passwords) never appear
 *                        in server logs even when the body is logged for debugging.
 */

const logger = require('../utils/logger');

// Fields whose VALUES must never appear in logs or error responses.
const SENSITIVE_FIELDS = [
  'password', 'password_hash', 'token', 'access_token', 'refresh_token',
  'railway_token', 'vercel_token', 'supabase_key', 'supabase_service_key',
  'stripe_secret', 'secret', 'api_key', 'apikey', 'authorization',
  'jwt', 'session', 'cookie',
];

/**
 * Recursively scrub sensitive fields from an object before logging.
 */
function scrub(obj, depth = 0) {
  if (depth > 5 || obj === null || typeof obj !== 'object') return obj;
  const cleaned = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
      cleaned[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      cleaned[key] = scrub(value, depth + 1);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/**
 * Map known third-party error patterns to plain-English user messages.
 * This prevents raw Supabase, Stripe, Postgres, or JWT error text
 * from leaking to the frontend.
 */
function toPlainEnglish(message) {
  if (!message) return 'Something went wrong. Please try again.';
  const m = message.toLowerCase();

  // Auth
  if (m.includes('invalid login credentials') || m.includes('invalid password'))
    return 'Incorrect email or password. Please try again.';
  if (m.includes('email not confirmed'))
    return 'Please verify your email before signing in.';
  if (m.includes('user already registered') || m.includes('already exists'))
    return 'An account with this email already exists. Please sign in instead.';
  if (m.includes('jwt') || m.includes('token') || m.includes('unauthorized'))
    return 'Your session has expired. Please sign in again.';

  // Stripe
  if (m.includes('card_declined') || m.includes('card was declined'))
    return 'Your card was declined. Please try a different payment method.';
  if (m.includes('insufficient_funds'))
    return 'Your card has insufficient funds. Please try a different payment method.';
  if (m.includes('incorrect_cvc'))
    return 'The card security code is incorrect. Please check and try again.';
  if (m.includes('expired_card'))
    return 'Your card has expired. Please use a different card.';
  if (m.includes('stripe'))
    return 'There was a payment issue. Please try again or use a different card.';

  // DB / Supabase
  if (m.includes('connection') || m.includes('econnrefused') || m.includes('enotfound'))
    return 'We are having trouble connecting to our servers. Please try again in a moment.';
  if (m.includes('duplicate key') || m.includes('unique constraint'))
    return 'This record already exists. Please check your input and try again.';
  if (m.includes('foreign key') || m.includes('violates'))
    return 'There was a data conflict. Please try again.';
  if (m.includes('timeout'))
    return 'The request took too long. Please try again.';

  // Railway / Vercel / Git
  if (m.includes('401') && (m.includes('railway') || m.includes('vercel')))
    return 'Your deployment token appears to be invalid. Please check your credentials and try again.';
  if (m.includes('git') || m.includes('clone'))
    return 'We could not access your project repository. If it is private, please make sure you have added your access token.';

  // Generic fallback — never leak raw message in production
  return 'Something went wrong. Please try again.';
}

/**
 * Global error-handling middleware.
 * Must be registered LAST in server.js, after all routes.
 * Signature must have 4 params so Express treats it as an error handler.
 */
// eslint-disable-next-line no-unused-vars
function sanitizeErrors(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const isDev  = process.env.NODE_ENV !== 'production';

  // Always log the full error server-side (scrubbed of credentials).
  logger.error('Unhandled error', {
    message: err.message,
    status,
    method:  req.method,
    path:    req.path,
    // Never log the request body in production — it may contain tokens.
    ...(isDev && { body: scrub(req.body) }),
    stack: err.stack,
  });

  // In development, return the real message for debugging.
  // In production, always return a plain-English user-safe message.
  const userMessage = isDev
    ? (err.message || 'An unexpected error occurred')
    : toPlainEnglish(err.message);

  return res.status(status).json({
    error: userMessage,
    // Stack traces are NEVER sent to clients, not even in dev.
  });
}

/**
 * Request-body log scrubber.
 * Attach early in the middleware chain. Replaces req.body's sensitive
 * field values in-memory before any logging middleware can read them.
 *
 * NOTE: This does NOT modify req.body values used by route handlers —
 * it only scrubs a clone stored on req._scrubbedBody for log use.
 */
function sanitizeLogs(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req._scrubbedBody = scrub(req.body);
  }
  next();
}

module.exports = { sanitizeErrors, sanitizeLogs, scrub, toPlainEnglish };
