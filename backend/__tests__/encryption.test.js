/**
 * backend/__tests__/encryption.test.js
 *
 * Skips gracefully when ENCRYPTION_KEY is the zero stub (non-production only).
 * In CI the key is 64 zeros which is a valid 32-byte AES key, so tests run.
 */
const crypto = require('crypto');

const KEY_HEX = process.env.ENCRYPTION_KEY || '';
const KEY_VALID = KEY_HEX.length === 64; // 64 hex chars = 32 bytes

const maybeDescribe = KEY_VALID ? describe : describe.skip;

maybeDescribe('Encryption Utils', () => {
  // Require inside the block so it doesn't throw at module load when key is bad
  const { encrypt, decrypt } = require('../utils/encryption');

  it('encrypts and decrypts correctly', () => {
    const original = 'secret-api-key-12345';
    const encrypted = encrypt(original);
    expect(encrypted).not.toBe(original);
    expect(encrypted).toContain(':');
    expect(decrypt(encrypted)).toBe(original);
  });

  it('produces different ciphertext for same input (random IV)', () => {
    const text = 'same-input';
    const enc1 = encrypt(text);
    const enc2 = encrypt(text);
    expect(enc1).not.toBe(enc2);
    expect(decrypt(enc1)).toBe(text);
    expect(decrypt(enc2)).toBe(text);
  });

  it('encrypts JSON objects serialised as strings', () => {
    const str = JSON.stringify({ token: 'abc123', secret: 'xyz' });
    const decrypted = JSON.parse(decrypt(encrypt(str)));
    expect(decrypted.token).toBe('abc123');
  });
});
