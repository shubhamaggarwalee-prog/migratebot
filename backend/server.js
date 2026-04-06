/**
 * backend/server.js
 */

const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const { Server } = require('socket.io');
require('dotenv').config();

const logger = require('./utils/logger');
const { sanitizeErrors, sanitizeLogs } = require('./middleware/errorSanitizer');

// ─── Rate-limit factories ─────────────────────────────────────────────────────
const rateLimit = require('./middleware/rateLimit');

const authLimiter    = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const billingLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20 });
const generalLimiter = rateLimit({ windowMs: 60 * 1000, max: 300 });

// ─── App + HTTP server ───────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

// ─── Socket.io ───────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin:  process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});
app.set('io', io);

// ─── Security headers (helmet) ───────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", 'https://js.stripe.com'],
      connectSrc:  ["'self'", process.env.FRONTEND_URL || 'http://localhost:3000'],
      frameSrc:    ["'self'", 'https://js.stripe.com'],
      imgSrc:      ["'self'", 'data:', 'https:'],
      styleSrc:    ["'self'", "'unsafe-inline'"],
    },
  },
  strictTransportSecurity: process.env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true }
    : false,
}));

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(cors({
  origin:         process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── HTTP request logging (morgan → winston) ─────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }));
} else if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Log sanitizer — scrub sensitive fields from req.body before any logging ─
app.use(sanitizeLogs);

// ─── Raw body for Stripe webhooks (MUST come before express.json) ─────────────
// Route must exactly match the path where the webhook router is mounted below.
// Stripe's constructEvent() requires the original raw Buffer — if express.json()
// runs first it parses the body into an object and the HMAC check fails.
app.use(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
);

// ─── JSON body parser ────────────────────────────────────────────────────────
// 50 MB: accommodates large ZIP payloads (files are base64-encoded in JSON).
// The per-file 500 KB cap in uploadSource.js is the abuse guard.
app.use(express.json({ limit: '50mb' }));

// ─── Tiered rate limiters ─────────────────────────────────────────────────────
app.use('/api/auth',     authLimiter);
app.use('/api/password', authLimiter);
app.use('/api/2fa',      authLimiter);
app.use('/api/billing',  billingLimiter);
app.use('/api',          generalLimiter);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/migrations',    require('./routes/migrations'));
app.use('/api/credentials',   require('./routes/credentials'));
app.use('/api/billing',       require('./routes/billing'));
app.use('/api/chat',          require('./routes/chat'));
app.use('/api/agent',         require('./routes/agentChat'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/health',        require('./routes/health'));
// webhooks.js exports makeRouter(app) — pass app so the safety-check timer
// can resolve the live io instance without a circular import.
app.use('/api/webhooks',      require('./routes/webhooks')(app));
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
  res.status(404).json({ error: 'The requested resource was not found.' });
});

// ─── Global error handler (sanitized — no stack traces or raw errors to client)
app.use(sanitizeErrors);

// ─── Socket.io connection handler ───────────────────────────────────────────
io.on('connection', socket => {
  socket.on('join',  room => socket.join(room));
  socket.on('leave', room => socket.leave(room));
});

// ─── Start (skip when required by tests) ────────────────────────────────────
if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => {
    logger.info(`MigrateBot backend running on :${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });
}

module.exports = { app, server };
