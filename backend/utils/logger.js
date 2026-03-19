/**
 * backend/utils/logger.js
 *
 * Winston structured logger.
 * Console transport: colourised in development, JSON in production.
 * File transports: logs/error.log (errors only) + logs/combined.log (all).
 */

'use strict';

const { createLogger, format, transports } = require('winston');
const path = require('path');

const { combine, timestamp, errors, json, colorize, printf } = format;

const IS_PROD = process.env.NODE_ENV === 'production';
const LOG_DIR = path.join(__dirname, '../../logs');

// ─── pretty console format for development ───────────────────────────────────
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `${ts} [${level}] ${stack || message}${metaStr}`;
  })
);

// ─── structured JSON format for production ───────────────────────────────────
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

const logger = createLogger({
  level: process.env.LOG_LEVEL || (IS_PROD ? 'info' : 'debug'),
  format: IS_PROD ? prodFormat : devFormat,
  defaultMeta: { service: 'migratebot-backend' },
  transports: [
    new transports.Console(),
    new transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize:  10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
      tailable: true,
      format: combine(timestamp(), errors({ stack: true }), json()),
    }),
    new transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      maxsize:  20 * 1024 * 1024, // 20 MB
      maxFiles: 10,
      tailable: true,
      format: combine(timestamp(), errors({ stack: true }), json()),
    }),
  ],
  // Don't exit on uncaught exceptions — let the process manager decide
  exitOnError: false,
});

// Stream interface for Morgan HTTP request logging
logger.stream = {
  write: (message) => logger.http(message.trimEnd()),
};

module.exports = logger;
