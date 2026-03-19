/**
 * backend/__tests__/encryption.test.js
 */
const { encrypt, decrypt } = require('../utils/encryption');

describe('Encryption Utils', () => {
  it('encrypts and decrypts a string correctly', () => {
    const original = 'secret-api-key-12345';
    const encrypted = encrypt(original);
    expect(encrypted).not.toBe(original);
    expect(encrypted).toContain(':');
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it('produces different ciphertext for same input (random IV)', () => {
    const text = 'same-input';
    const enc1 = encrypt(text);
    const enc2 = encrypt(text);
    expect(enc1).not.toBe(enc2);
    expect(decrypt(enc1)).toBe(text);
    expect(decrypt(enc2)).toBe(text);
  });

  it('encrypts JSON objects as strings', () => {
    const obj = { token: 'abc123', secret: 'xyz' };
    const str = JSON.stringify(obj);
    const encrypted = encrypt(str);
    const decrypted = JSON.parse(decrypt(encrypted));
    expect(decrypted.token).toBe('abc123');
    expect(decrypted.secret).toBe('xyz');
  });
});
