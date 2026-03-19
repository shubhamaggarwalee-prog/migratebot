/**
 * backend/services/totp.js
 *
 * RFC 6238 TOTP (Time-based One-Time Password) implementation.
 * Zero external dependencies — uses Node.js built-in `crypto` only.
 *
 * Exports:
 *   generateTotpSecret()             Generate a random base32 secret
 *   generateTotpUri(secret, opts)    Build an otpauth:// URI for QR codes
 *   verifyTotp(token, secret, opts)  Verify a 6-digit code with window tolerance
 *   generateBackupCodes(n)           Generate one-time-use backup codes
 *   hashBackupCode(code)             SHA-256 hash for safe DB storage
 *   verifyBackupCode(code, hash)     Constant-time comparison against stored hash
 */

'use strict';

const crypto = require('crypto');

// ─── BASE32 ───────────────────────────────────────────────────────────────────
// RFC 4648 base32 alphabet (uppercase, no padding required for TOTP)

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encode a Buffer/Uint8Array to base32 string (no padding).
 * @param {Buffer} buf
 * @returns {string}
 */
function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += BASE32_ALPHABET[(value >>> bits) & 0x1f];
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return output;
}

/**
 * Decode a base32 string to a Buffer.
 * Accepts both upper and lower case; silently skips padding ('=').
 * @param {string} str
 * @returns {Buffer}
 */
function base32Decode(str) {
  const s = str.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const output = [];
  for (let i = 0; i < s.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(s[i]);
    if (idx === -1) throw new Error(`Invalid base32 character: '${s[i]}'`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(output);
}

// ─── HOTP CORE (RFC 4226) ───────────────────────────────────────────────────────────

/**
 * Generate an HOTP value for a given key and counter.
 * RFC 4226 §5.3
 *
 * @param {Buffer} keyBuf   - Raw secret bytes
 * @param {number} counter  - 64-bit counter value
 * @param {number} digits   - OTP length (default 6)
 * @returns {string}  Zero-padded numeric OTP string
 */
function hotp(keyBuf, counter, digits = 6) {
  // Pack counter as big-endian 8-byte buffer
  const counterBuf = Buffer.alloc(8);
  // JavaScript numbers are safe up to 2^53; split into high/low 32-bit words
  const high = Math.floor(counter / 0x100000000);
  const low  = counter >>> 0;
  counterBuf.writeUInt32BE(high, 0);
  counterBuf.writeUInt32BE(low,  4);

  // HMAC-SHA1
  const hmac   = crypto.createHmac('sha1', keyBuf);
  hmac.update(counterBuf);
  const digest = hmac.digest();

  // Dynamic truncation
  const offset = digest[digest.length - 1] & 0x0f;
  const code   =
    ((digest[offset]     & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) <<  8) |
     (digest[offset + 3] & 0xff);

  return String(code % Math.pow(10, digits)).padStart(digits, '0');
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random TOTP secret.
 *
 * @param {number} [byteLength=20]  - 20 bytes = 160 bits (recommended by RFC 4226)
 * @returns {{ secret: string, secretBase32: string }}
 *   secret      - raw hex string (for internal storage if you prefer)
 *   secretBase32 - base32-encoded string (for authenticator apps / QR codes)
 */
function generateTotpSecret(byteLength = 20) {
  const buf          = crypto.randomBytes(byteLength);
  const secretBase32 = base32Encode(buf);
  return {
    secret:       buf.toString('hex'),
    secretBase32,
  };
}

/**
 * Build an otpauth:// URI for QR code generation.
 * Compatible with Google Authenticator, Authy, 1Password, Bitwarden, etc.
 *
 * @param {string} secretBase32  - Base32-encoded secret
 * @param {object} opts
 * @param {string}  opts.issuer   - Service name shown in authenticator app (e.g. 'MigrateBot')
 * @param {string}  opts.account  - User identifier (usually email)
 * @param {number}  [opts.digits=6]
 * @param {number}  [opts.period=30]  - Time step in seconds
 * @param {string}  [opts.algorithm='SHA1']
 * @returns {string}  Full otpauth:// URI
 */
function generateTotpUri(secretBase32, { issuer = 'MigrateBot', account, digits = 6, period = 30, algorithm = 'SHA1' } = {}) {
  if (!account) throw new Error('account is required for generateTotpUri');
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    secret:    secretBase32,
    issuer,
    algorithm,
    digits:    String(digits),
    period:    String(period),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/**
 * Verify a TOTP token against a secret with configurable time-window tolerance.
 *
 * Checks `window` steps either side of the current counter to account for:
 *   - Clock drift between server and user device
 *   - Slow token entry
 *
 * @param {string} token         - 6-digit string entered by the user
 * @param {string} secretBase32  - Base32-encoded secret (stored per-user)
 * @param {object} [opts]
 * @param {number}  [opts.window=1]   - Number of steps to check either side (1 = ±30s tolerance)
 * @param {number}  [opts.period=30]  - Time step in seconds (must match URI)
 * @param {number}  [opts.digits=6]
 * @param {number}  [opts.timestamp]  - Unix ms timestamp (defaults to Date.now(); injectable for testing)
 * @returns {{ valid: boolean, delta: number|null }}
 *   valid - whether the token matched
 *   delta - which step offset matched (-window..+window), or null if invalid
 */
function verifyTotp(token, secretBase32, { window = 1, period = 30, digits = 6, timestamp } = {}) {
  // Normalise: strip spaces, must be all digits
  const normalised = String(token).replace(/\s+/g, '');
  if (!/^\d+$/.test(normalised) || normalised.length !== digits) {
    return { valid: false, delta: null };
  }

  let keyBuf;
  try {
    keyBuf = base32Decode(secretBase32);
  } catch {
    return { valid: false, delta: null };
  }

  const now     = timestamp !== undefined ? timestamp : Date.now();
  const counter = Math.floor(now / 1000 / period);

  for (let delta = -window; delta <= window; delta++) {
    const expected = hotp(keyBuf, counter + delta, digits);
    // Constant-time string comparison to prevent timing attacks
    if (constantTimeEqual(normalised, expected)) {
      return { valid: true, delta };
    }
  }

  return { valid: false, delta: null };
}

/**
 * Generate one-time-use backup codes.
 * Each code is formatted as XXXX-XXXX-XXXX for readability.
 *
 * @param {number} [count=10]       - Number of codes to generate
 * @param {number} [bytesEach=6]    - Entropy per code (6 bytes = 48 bits)
 * @returns {string[]}  Array of plaintext backup codes (show once, then hash)
 */
function generateBackupCodes(count = 10, bytesEach = 6) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const buf = crypto.randomBytes(bytesEach);
    const hex = buf.toString('hex').toUpperCase(); // 12 hex chars
    // Format as XXXX-XXXX-XXXX
    codes.push(`${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`);
  }
  return codes;
}

/**
 * Hash a backup code for safe storage in the database.
 * Uses SHA-256; backup codes are high-entropy so no salt is required.
 *
 * @param {string} code  - Plaintext backup code (e.g. 'A1B2-C3D4-E5F6')
 * @returns {string}  Hex-encoded SHA-256 hash
 */
function hashBackupCode(code) {
  return crypto
    .createHash('sha256')
    .update(code.toUpperCase().replace(/-/g, ''))
    .digest('hex');
}

/**
 * Verify a backup code against a stored hash using constant-time comparison.
 *
 * @param {string} code          - Plaintext code entered by the user
 * @param {string} storedHash    - Hex SHA-256 hash from the database
 * @returns {boolean}
 */
function verifyBackupCode(code, storedHash) {
  const inputHash = hashBackupCode(code);
  // Pad to equal length before timingSafeEqual (both are 64-char hex)
  try {
    return crypto.timingSafeEqual(
      Buffer.from(inputHash,  'hex'),
      Buffer.from(storedHash, 'hex')
    );
  } catch {
    return false;
  }
}

// ─── INTERNAL UTILS ────────────────────────────────────────────────────────────────

/**
 * Constant-time string comparison.
 * Prevents timing oracle attacks where an attacker measures response time
 * to infer how many characters of the OTP matched.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
  generateTotpSecret,
  generateTotpUri,
  verifyTotp,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
  // Exported for unit testing
  _base32Encode: base32Encode,
  _base32Decode: base32Decode,
  _hotp:         hotp,
};
