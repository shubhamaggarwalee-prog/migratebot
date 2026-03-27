/**
 * backend/__tests__/credentials.test.js
 */
const request = require('supertest');
const { app } = require('../server');

const FAKE_TOKEN = 'Bearer invalid.jwt.token';

describe('Credentials Routes — auth guards', () => {
  // GET /api/credentials/:migration_id  (no bare GET / exists)
  describe('GET /api/credentials/:migration_id', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app).get('/api/credentials/some-migration-id');
      expect(res.status).toBe(401);
    });
    it('returns 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/credentials/some-migration-id')
        .set('Authorization', FAKE_TOKEN);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/credentials', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app)
        .post('/api/credentials')
        .send({ platform: 'github', token: 'abc' });
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
        .send({ platform: 'github' });
      expect(res.status).toBe(401);
    });
  });
});
