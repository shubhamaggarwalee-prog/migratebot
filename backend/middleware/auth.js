/**
 * backend/middleware/auth.js
 * JWT authentication middleware
 */
const { verifyToken } = require('../utils/jwt');

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing or malformed' });
  }
  const token = header.slice(7);
  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    req.user   = { id: payload.userId, email: payload.email }; // req.user.id used by pushChange/updateDeploy
    req.email  = payload.email;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Default export (used by most routes as: const auth = require('../middleware/auth'))
module.exports = auth;
// Named export (used by pushChange.js and updateDeploy.js as: const { requireAuth } = require(...))
module.exports.requireAuth = auth;
