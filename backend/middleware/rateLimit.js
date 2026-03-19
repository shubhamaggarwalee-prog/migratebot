/**
 * backend/middleware/rateLimit.js
 * Simple in-memory rate limiter
 */
const requests = new Map();

module.exports = function rateLimit({ windowMs = 60000, max = 60 } = {}) {
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;
    const timestamps = (requests.get(key) || []).filter(t => t > windowStart);
    if (timestamps.length >= max) {
      return res.status(429).json({ error: 'Too many requests, please slow down' });
    }
    timestamps.push(now);
    requests.set(key, timestamps);
    next();
  };
};
