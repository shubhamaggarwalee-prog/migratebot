/**
 * backend/server.js
 * Main Express server entry point
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const { initDatabase } = require('./utils/db');
const { initQueue } = require('./utils/queue');

const authRoutes = require('./routes/auth');
const migrationRoutes = require('./routes/migrations');
const webhookRoutes = require('./routes/webhooks');
const healthRoutes = require('./routes/health');
const credentialRoutes = require('./routes/credentials');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', methods: ['GET', 'POST'] },
});

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(morgan('combined'));

// Raw body for Stripe webhooks
app.use('/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Attach io to req
app.use((req, _res, next) => { req.io = io; next(); });

// Routes
app.use('/auth', authRoutes);
app.use('/api/migrations', migrationRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/health', healthRoutes);
app.use('/api/credentials', credentialRoutes);

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3001;

async function start() {
  await initDatabase();
  await initQueue(io);
  server.listen(PORT, () => console.log(`MigrateBot backend running on port ${PORT}`));
}

start().catch(err => { console.error('Startup failed:', err); process.exit(1); });

module.exports = { app, io };
