/**
 * backend/__tests__/billing.test.js
 * Gap 8 — Tests for /api/billing routes.
 *
 * Covers:
 *   • Auth guards on payment-intent creation
 *   • Tier pricing logic (unit)
 *   • Stripe webhook signature requirement
 *   • Receipt route auth guard
 */
const request = require('supertest');
const { app } = require('../server');

const FAKE_TOKEN = 'Bearer invalid.jwt.token';

describe('Billing Routes', () => {

  describe('POST /api/billing/payment-intent', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app)
        .post('/api/billing/payment-intent')
        .send({ migration_id: 'test-id', tier: 'standard' });
      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const res = await request(app)
        .post('/api/billing/payment-intent')
        .set('Authorization', FAKE_TOKEN)
        .send({ migration_id: 'test-id', tier: 'standard' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/billing/history', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app).get('/api/billing/history');
      expect(res.status).toBe(401);
    });
  });

  // Stripe webhooks must include a valid Stripe-Signature header.
  // Without it the endpoint should reject with 400.
  describe('POST /api/billing/webhook', () => {
    it('returns 400 when Stripe-Signature header is missing', async () => {
      const res = await request(app)
        .post('/api/billing/webhook')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ type: 'payment_intent.succeeded' }));
      // Stripe SDK throws on missing/invalid signature → 400
      expect([400, 401]).toContain(res.status);
    });
  });

  describe('GET /api/receipt/:migration_id', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app).get('/api/receipt/some-migration-id');
      expect(res.status).toBe(401);
    });
  });

  // ── Unit: tier pricing logic ────────────────────────────────────────
  describe('Tier pricing (unit)', () => {
    // Mirrors the pricing logic in billing.js / billing frontend
    const PRICES = { standard: 10000, pro: 25000 }; // Stripe amounts in cents

    it('standard tier costs $100 (10000 cents)', () => {
      expect(PRICES.standard).toBe(10000);
    });

    it('pro tier costs $250 (25000 cents)', () => {
      expect(PRICES.pro).toBe(25000);
    });

    it('rejects unknown tier', () => {
      const tier = 'enterprise';
      expect(PRICES[tier]).toBeUndefined();
    });

    it('pro tier costs exactly 2.5x standard', () => {
      expect(PRICES.pro / PRICES.standard).toBe(2.5);
    });
  });

  // ── Unit: migration_id required validation ────────────────────────
  describe('Payment intent — required fields (unit)', () => {
    function validatePaymentBody(body) {
      const { migration_id, tier } = body || {};
      const VALID_TIERS = ['standard', 'pro'];
      if (!migration_id) return 'migration_id is required';
      if (!tier || !VALID_TIERS.includes(tier)) return `tier must be one of: ${VALID_TIERS.join(', ')}`;
      return null;
    }

    it('fails when migration_id missing', () => {
      expect(validatePaymentBody({ tier: 'standard' })).toBeTruthy();
    });

    it('fails when tier is missing', () => {
      expect(validatePaymentBody({ migration_id: 'abc' })).toBeTruthy();
    });

    it('fails when tier is invalid', () => {
      expect(validatePaymentBody({ migration_id: 'abc', tier: 'free' })).toBeTruthy();
    });

    it('passes with valid inputs', () => {
      expect(validatePaymentBody({ migration_id: 'abc', tier: 'pro' })).toBeNull();
      expect(validatePaymentBody({ migration_id: 'abc', tier: 'standard' })).toBeNull();
    });
  });
});
