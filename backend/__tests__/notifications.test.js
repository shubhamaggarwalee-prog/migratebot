/**
 * backend/__tests__/notifications.test.js
 */
const request = require('supertest');
const { app } = require('../server');

const FAKE_TOKEN = 'Bearer invalid.jwt.token';

describe('Notifications Routes — auth guards', () => {
  describe('GET /api/notifications/prefs', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app).get('/api/notifications/prefs');
      expect(res.status).toBe(401);
    });
    it('returns 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/notifications/prefs')
        .set('Authorization', FAKE_TOKEN);
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/notifications/prefs', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app)
        .put('/api/notifications/prefs')
        .send({ migration_completed: true });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/notifications/slack', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app)
        .post('/api/notifications/slack')
        .send({ webhookUrl: 'https://hooks.slack.com/services/abc' });
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/notifications/slack', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app).delete('/api/notifications/slack');
      expect(res.status).toBe(401);
    });
  });

  // — Unit: Slack URL validation —
  describe('Slack webhook URL validation (unit)', () => {
    const isValidSlack = (url) =>
      !!url && url.startsWith('https://hooks.slack.com/');

    it('accepts valid hooks.slack.com URL',    () => expect(isValidSlack('https://hooks.slack.com/services/T/B/x')).toBe(true));
    it('rejects non-hooks domain',             () => expect(isValidSlack('https://evil.com/hooks.slack.com')).toBe(false));
    it('rejects http (not https)',             () => expect(isValidSlack('http://hooks.slack.com/services/abc')).toBe(false));
    it('rejects empty string',                 () => expect(isValidSlack('')).toBe(false));
  });

  // — Unit: prefs allow-list —
  describe('Notification prefs allow-list (unit)', () => {
    const ALLOWED = ['migration_completed','migration_failed','health_check_alerts','product_updates','billing_receipts'];
    const filter = (body) => {
      const out = {};
      for (const k of ALLOWED) if (typeof body[k] === 'boolean') out[k] = body[k];
      return out;
    };

    it('keeps valid boolean keys',       () => expect(filter({ migration_completed: true })).toEqual({ migration_completed: true }));
    it('strips unknown keys',            () => expect(filter({ unknown_key: true })).toEqual({}));
    it('strips non-boolean valid keys',  () => expect(filter({ migration_completed: 'yes' })).toEqual({}));
  });
});
