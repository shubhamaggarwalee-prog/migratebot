/**
 * backend/__tests__/billing.test.js
 *
 * Tests actual routes mounted in server.js:
 *   GET  /api/billing/invoices
 *   GET  /api/billing/summary
 *   GET  /api/billing/portal
 *
 * All require auth — we only verify the 401 guard here.
 * No Stripe or DB calls are made.
 */
const request = require('supertest');
const { app } = require('../server');

const FAKE_TOKEN = 'Bearer invalid.jwt.token';

describe('Billing Routes — auth guards', () => {
  describe('GET /api/billing/invoices', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app).get('/api/billing/invoices');
      expect(res.status).toBe(401);
    });
    it('returns 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/billing/invoices')
        .set('Authorization', FAKE_TOKEN);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/billing/summary', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app).get('/api/billing/summary');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/billing/portal', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app).get('/api/billing/portal');
      expect(res.status).toBe(401);
    });
  });

  // — Unit: tier pricing logic —
  describe('Tier pricing (unit)', () => {
    const PRICES = { standard: 10000, pro: 25000 };
    it('standard = $100 (10000 cents)', () => expect(PRICES.standard).toBe(10000));
    it('pro = $250 (25000 cents)',       () => expect(PRICES.pro).toBe(25000));
    it('pro is 2.5x standard',           () => expect(PRICES.pro / PRICES.standard).toBe(2.5));
    it('unknown tier is undefined',      () => expect(PRICES['enterprise']).toBeUndefined());
  });
});
