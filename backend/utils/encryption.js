/**
 * backend/utils/encryption.js
 * AES-256-GCM encryption for stored credentials
 */
const crypto = require('crypto');

const KEY = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
if (KEY.length !== 32) {
  if (process.env.NODE_ENV === 'production') throw new Error('ENCRYPTION_KEY must be 64-char hex (32 bytes)');
}

const ALGO = 'aes-256-gcm';

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
}

function decrypt(data) {
  const [ivHex, tagHex, encryptedHex] = data.split(':');
  const decipher = crypto.createDecipheriv(ALGO, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encryptedHex, 'hex')) + decipher.final('utf8');
}

module.exports = { encrypt, decrypt };
