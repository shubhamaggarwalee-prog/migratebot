/**
 * backend/server.js
 * Main Express server entry point
 */
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const http    = require('http');
const { Server } = require('socket.io');

const logger      = require('./utils/logger');
const { initSchema } = require('./utils/database');
const { initQueue }  = require('./utils/queue');

// ─── Route imports ────────────────────────────────────────────────────────────
const authRoutes              = require('./routes/auth');
const migrationRoutes         = require('./routes/migrations');
const webhookRoutes           = require('./routes/webhooks');
const healthRoutes            = require('./routes/health');
const credentialRoutes        = require('./routes/credentials');
const billingRoutes           = require('./routes/billing');
const twoFactorRoutes         = require('./routes/twoFactor');
const emailVerificationRoutes = require('./routes/emailVerification');
const notificationRoutes      = require('./routes/notifications');
const passwordResetRoutes     = require('./routes/passwordReset');

const app    = express();
const server = http.createServer(app);

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean);

function corsOrigin(origin, callback) {
  // Allow requests with no origin (mobile apps, curl, Postman)
  if (!origin) return callback(null, true);
  // Allow any vercel.app subdomain (preview deployments)
  if (origin.endsWith('.vercel.app')) return callback(null, true);
  // Allow explicitly listed origins
  if (allowedOrigins.includes(origin)) return callback(null, true);
  callback(new Error(`CORS blocked: ${origin}`));
}

const corsOptions = { origin: corsOrigin, credentials: true };

const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors(corsOptions));
app.use(morgan('combined', { stream: logger.stream }));

// Raw body for Stripe webhooks — must come before express.json()
app.use('/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Attach Socket.io instance to every request
app.use((req, _res, next) => { req.io = io; next(); });

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/auth',                  authRoutes);
app.use('/api/migrations',        migrationRoutes);
app.use('/webhooks',              webhookRoutes);
app.use('/health',                healthRoutes);
app.use('/api/credentials',       credentialRoutes);
app.use('/api/billing',           billingRoutes);
app.use('/api/2fa',               twoFactorRoutes);
app.use('/api/email',             emailVerificationRoutes);
app.use('/api/notifications',     notificationRoutes);
app.use('/api/auth',              passwordResetRoutes);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error:', { message: err.message, stack: err.stack });
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

async function start() {
  await initSchema();
  await initQueue(io);
  server.listen(PORT, () => logger.info(`MigrateBot backend running on port ${PORT}`));
}

start().catch(err => {
  logger.error('Startup failed:', err);
  process.exit(1);
});

module.exports = { app, io };
