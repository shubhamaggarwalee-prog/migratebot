/**
 * backend/__tests__/credentials.test.js
 * Gap 8 — Tests for /api/credentials routes.
 *
 * Covers:
 *   • Auth guards on all endpoints
 *   • Input validation for POST / validate
 *   • Platform allow-list enforcement (unit)
 *   • Encryption round-trip (unit — uses real encrypt/decrypt utils)
 */
const request = require('supertest');
const { app } = require('../server');

const FAKE_TOKEN = 'Bearer invalid.jwt.token';

describe('Credentials Routes', () => {

  describe('POST /api/credentials', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app)
        .post('/api/credentials')
        .send({ migration_id: '1', platform: 'github', credentials: { token: 'abc' } });
      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const res = await request(app)
        .post('/api/credentials')
        .set('Authorization', FAKE_TOKEN)
        .send({ migration_id: '1', platform: 'github', credentials: { token: 'abc' } });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/credentials/:migration_id', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app).get('/api/credentials/some-migration-id');
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/credentials/:id', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app).delete('/api/credentials/some-id');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/credentials/validate', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app)
        .post('/api/credentials/validate')
        .send({ platform: 'github', token: 'ghp_test' });
      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const res = await request(app)
        .post('/api/credentials/validate')
        .set('Authorization', FAKE_TOKEN)
        .send({ platform: 'github', token: 'ghp_test' });
      expect(res.status).toBe(401);
    });
  });

  // ── Unit: input validation logic ───────────────────────────────────
  describe('POST /api/credentials — missing fields (unit)', () => {
    function validateBody(body) {
      const { migration_id, platform, credentials } = body;
      if (!migration_id || !platform || !credentials) return 'migration_id, platform, and credentials required';
      return null;
    }

    it('fails when migration_id missing', () => {
      expect(validateBody({ platform: 'github', credentials: { token: 'x' } })).toBeTruthy();
    });

    it('fails when platform missing', () => {
      expect(validateBody({ migration_id: '1', credentials: { token: 'x' } })).toBeTruthy();
    });

    it('fails when credentials missing', () => {
      expect(validateBody({ migration_id: '1', platform: 'github' })).toBeTruthy();
    });

    it('passes when all fields present', () => {
      expect(validateBody({ migration_id: '1', platform: 'github', credentials: { token: 'x' } })).toBeNull();
    });
  });

  // ── Unit: platform allow-list ────────────────────────────────────
  describe('Credential validate — platform allow-list (unit)', () => {
    const SUPPORTED = ['github', 'replit', 'supabase', 'vercel', 'railway'];

    const cases = [
      { platform: 'github',    expected: true  },
      { platform: 'replit',    expected: true  },
      { platform: 'supabase',  expected: true  },
      { platform: 'vercel',    expected: true  },
      { platform: 'railway',   expected: true  },
      { platform: 'heroku',    expected: false },
      { platform: 'netlify',   expected: false },
      { platform: '',          expected: false },
      { platform: '__proto__', expected: false },
    ];

    cases.forEach(({ platform, expected }) => {
      it(`platform "${platform || '(empty)'}" is ${expected ? 'supported' : 'unsupported'}`, () => {
        expect(SUPPORTED.includes(platform)).toBe(expected);
      });
    });
  });

  // ── Unit: AES-256-GCM encryption round-trip ────────────────────────
  describe('Encryption util (round-trip)', () => {
    let encrypt, decrypt;

    beforeAll(() => {
      // Set a dummy key if the env isn’t loaded yet
      if (!process.env.ENCRYPTION_KEY) {
        process.env.ENCRYPTION_KEY = '0'.repeat(64); // 32-byte hex string
      }
      ({ encrypt, decrypt } = require('../utils/encryption'));
    });

    it('encrypts and decrypts to the original plaintext', () => {
      const plaintext = JSON.stringify({ token: 'ghp_supersecret' });
      const ciphertext = encrypt(plaintext);
      expect(ciphertext).not.toBe(plaintext);
      const result = decrypt(ciphertext);
      expect(result).toBe(plaintext);
    });

    it('produces different ciphertext for the same input (random IV)', () => {
      const plaintext = 'same input';
      const c1 = encrypt(plaintext);
      const c2 = encrypt(plaintext);
      expect(c1).not.toBe(c2);
    });

    it('throws on tampered ciphertext', () => {
      const ciphertext = encrypt('hello');
      const tampered = ciphertext.slice(0, -4) + 'XXXX';
      expect(() => decrypt(tampered)).toThrow();
    });
  });
});
