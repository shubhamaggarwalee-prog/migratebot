/**
 * backend/server.js
 * Gap 12 — Security hardening
 *
 * Changes vs the previous version:
 *   1. helmet()           — 15 security headers (CSP, HSTS, X-Frame-Options, etc.)
 *   2. morgan             — structured HTTP request logging via winston
 *   3. Tiered rate limits — strict on auth/billing/2fa, relaxed on general API
 *   4. Raw-body bypass    — Stripe webhook needs the raw buffer before json()
 *   5. Global error handler — catches any unhandled error, logs it, returns 500
 *                             without leaking stack traces in production
 */

const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const { Server } = require('socket.io');
require('dotenv').config();

const logger = require('./utils/logger');

// ─── Rate-limit factories ─────────────────────────────────────────────────────
// We keep the in-memory implementation for now (no extra dep) but expose
// named limiters with appropriate windows + ceilings per route group.
const rateLimit = require('./middleware/rateLimit');

/**
 * Auth limiter  — 10 attempts per 15 min per IP.
 * Protects login, register, password-reset, and 2FA verify against brute force.
 */
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

/**
 * Billing limiter — 20 requests per 10 min per IP.
 * Prevents Stripe payment-intent spam.
 */
const billingLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20 });

/**
 * General API limiter — 300 requests per 1 min per IP.
 * A generous ceiling that still stops runaway scripts.
 */
const generalLimiter = rateLimit({ windowMs: 60 * 1000, max: 300 });

// ─── App + HTTP server ────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin:  process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});
app.set('io', io);

// ─── Security headers (helmet) ────────────────────────────────────────────────
// helmet() sets: Content-Security-Policy, X-Frame-Options, X-Content-Type-Options,
// Strict-Transport-Security, Referrer-Policy, X-DNS-Prefetch-Control, and more.
app.use(helmet({
  // Allow our WebSocket upgrade and Stripe JS on the frontend
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", 'https://js.stripe.com'],
      connectSrc:  ["'self'", process.env.FRONTEND_URL || 'http://localhost:3000'],
      frameSrc:    ["'self'", 'https://js.stripe.com'],
      imgSrc:      ["'self'", 'data:', 'https:'],
      styleSrc:    ["'self'", "'unsafe-inline'"],  // Next.js injects inline styles
    },
  },
  // Enforce HTTPS in production only
  strictTransportSecurity: process.env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true }
    : false,
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── HTTP request logging (morgan → winston) ──────────────────────────────────
// In production: combined Apache format piped into winston so it ends up in the
// same log stream as application logs.
// In development: concise 'dev' format printed to stdout.
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }));
} else {
  app.use(morgan('dev'));
}

// ─── Raw body for Stripe webhooks ────────────────────────────────────────────
// express.json() consumes the body stream. Stripe requires the raw Buffer to
// verify the webhook signature, so we capture it on this one path BEFORE the
// global json() middleware.
app.use(
  '/api/billing/webhook',
  express.raw({ type: 'application/json' }),
);

// ─── JSON body parser (all other routes) ─────────────────────────────────────
// 10 mb is sufficient for code uploads; the previous 25 mb was overly generous.
app.use(express.json({ limit: '10mb' }));

// ─── Tiered rate limiters ─────────────────────────────────────────────────────
// Applied before routes so they short-circuit before any DB/crypto work.
app.use('/api/auth',     authLimiter);
app.use('/api/password', authLimiter);    // password-reset routes
app.use('/api/2fa',      authLimiter);    // TOTP brute-force guard
app.use('/api/billing',  billingLimiter);
app.use('/api',          generalLimiter); // everything else

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/migrations',    require('./routes/migrations'));
app.use('/api/credentials',   require('./routes/credentials'));
app.use('/api/billing',       require('./routes/billing'));
app.use('/api/chat',          require('./routes/chat'));
app.use('/api/agent',         require('./routes/agentChat'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/health',        require('./routes/health'));
app.use('/api/webhooks',      require('./routes/webhooks'));
app.use('/api/2fa',           require('./routes/twoFactor'));
app.use('/api/password',      require('./routes/passwordReset'));
app.use('/api/verify-email',  require('./routes/emailVerification'));
app.use('/api/push-change',   require('./routes/pushChange'));
app.use('/api/upload-source', require('./routes/uploadSource'));
app.use('/api/update-deploy', require('./routes/updateDeploy'));
app.use('/api/app-health',    require('./routes/appHealth'));
app.use('/api/receipt',       require('./routes/receipt'));

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// Must be declared with FOUR parameters for Express to recognise it as an error
// handler. Catches any error passed via next(err) or thrown inside async routes
// that use a try/catch forwarding to next().
//
// In production: logs the full error internally but returns only a generic
//   message to the client — no stack traces exposed.
// In development: includes the stack in the response for easier debugging.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const isDev  = process.env.NODE_ENV !== 'production';

  // Always log the full error server-side
  logger.error('Unhandled error', {
    message:  err.message,
    status,
    method:   req.method,
    path:     req.path,
    stack:    err.stack,
  });

  res.status(status).json({
    error: isDev ? err.message : 'An unexpected error occurred',
    ...(isDev && { stack: err.stack }),
  });
});

// ─── Socket.io connection handler ────────────────────────────────────────────
io.on('connection', socket => {
  socket.on('join',  room => socket.join(room));
  socket.on('leave', room => socket.leave(room));
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  logger.info(`MigrateBot backend running on :${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app; // export for supertest
